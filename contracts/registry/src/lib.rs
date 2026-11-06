//! Handover registry — NEP-171 tokens whose holders own a vault account.
//!
//! One deployment. Each token points at a sub-account running the `vault` contract.
//! The registry's only privileged act on that account is `set_holder`, which rotates
//! the owner key during a transfer. The operator key is never touched here, so a
//! business keeps running across a change of hands.
//!
//! Transfer is a **two-beat** protocol, not an atomic one. NEAR cross-contract calls
//! are separate receipts: if the vault's receipt commits and this contract's callback
//! later fails, the key rotation is *not* rolled back. So each transfer walks an
//! explicit state machine (`Pending -> Applied | Failed`) with a permissionless
//! `resolve_rotation` to retry or revert. See docs/SPEC.md §6.

use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::store::{IterableMap, LazyOption, LookupMap};
use near_sdk::{
    env, near, require, AccountId, Gas, NearToken, PanicOnDefault, Promise, PublicKey,
};

/// Deposit required to mint. Covers sub-account creation + vault wasm storage + state.
/// The real cost is measured after deployment and published in the README.
const MIN_MINT_DEPOSIT: u128 = 4_000_000_000_000_000_000_000_000; // 4 NEAR
/// Attached to `set_holder` so the vault can pay for the new access key's storage.
const ROTATION_DEPOSIT: u128 = 50_000_000_000_000_000_000_000; // 0.05 NEAR
const OPERATOR_ALLOWANCE: u128 = 500_000_000_000_000_000_000_000; // 0.5 NEAR
const OPERATOR_METHODS: &str = "record_sale,operator_spend";

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub struct Rules {
    pub max_spend_per_epoch: U128,
    pub max_single_spend: U128,
    pub epoch_secs: u64,
    pub allow_recipients: Vec<AccountId>,
    pub claim_cooldown_secs: u64,
    pub rules_delay_secs: u64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct TokenRecord {
    pub vault: AccountId,
    pub holder: AccountId,
    pub operator: AccountId,
    pub epoch: u32,
    pub created_at: u64,
}

#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq, Eq)]
pub enum Rotation {
    None,
    Pending {
        epoch: u32,
        from: AccountId,
        to: AccountId,
        key: String,
    },
    Applied {
        epoch: u32,
        to: AccountId,
        at: u64,
    },
    Failed {
        epoch: u32,
        from: AccountId,
        to: AccountId,
        key: String,
        reason: String,
    },
}

#[near(serializers = [json])]
#[derive(Clone)]
pub struct JsonToken {
    pub token_id: String,
    pub owner_id: AccountId,
    pub vault: AccountId,
    pub operator: AccountId,
    pub epoch: u32,
}

#[near(serializers = [json, borsh])]
#[derive(Clone)]
pub struct NFTContractMetadata {
    pub spec: String,
    pub name: String,
    pub symbol: String,
    pub icon: Option<String>,
    pub base_uri: Option<String>,
    pub reference: Option<String>,
    pub reference_hash: Option<String>,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Registry {
    owner_id: AccountId,
    minter: AccountId,
    mint_paused: bool,
    metadata: NFTContractMetadata,
    tokens: IterableMap<String, TokenRecord>,
    rotation: LookupMap<String, Rotation>,
    vault_code: LazyOption<Vec<u8>>,
    total_supply: u64,
}

#[near]
impl Registry {
    #[init]
    pub fn new(owner_id: AccountId, minter: AccountId, metadata: NFTContractMetadata) -> Self {
        Self {
            owner_id,
            minter,
            mint_paused: false,
            metadata,
            tokens: IterableMap::new(b"t"),
            rotation: LookupMap::new(b"r"),
            vault_code: LazyOption::new(b"c", None),
            total_supply: 0,
        }
    }

    // ------------------------------------------------------------------- admin

    #[payable]
    pub fn store_vault_code(&mut self, code: Vec<u8>) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "E01: only the owner may store code"
        );
        require!(!code.is_empty(), "E13: empty code");
        self.vault_code.set(Some(code));
    }

    pub fn set_minter(&mut self, minter: AccountId) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "E01: only the owner may set the minter"
        );
        self.minter = minter;
    }

    pub fn pause_mint(&mut self, paused: bool) {
        require!(
            env::predecessor_account_id() == self.owner_id,
            "E01: only the owner may pause"
        );
        self.mint_paused = paused;
    }

    // -------------------------------------------------------------------- mint

    /// Create a business: a sub-account, its vault contract, its two keys, and a token.
    /// The batch is atomic at the protocol level — the account is never half-keyed.
    #[payable]
    pub fn mint_business(
        &mut self,
        token_id: String,
        operator: AccountId,
        operator_pubkey: PublicKey,
        owner_pubkey: PublicKey,
        rules: Rules,
    ) -> Promise {
        require!(
            env::predecessor_account_id() == self.minter,
            "E01: only the minter may mint"
        );
        require!(!self.mint_paused, "E10: minting is paused");
        require!(!self.tokens.contains_key(&token_id), "E02: token exists");
        Self::validate_token_id(&token_id);

        let deposit = env::attached_deposit().as_yoctonear();
        require!(deposit >= MIN_MINT_DEPOSIT, "E11: insufficient mint deposit");

        let code = self
            .vault_code
            .get()
            .as_ref()
            .expect("E14: vault code not stored")
            .clone();
        let depositor = env::predecessor_account_id();
        let vault_id: AccountId = format!("{}.{}", token_id, env::current_account_id())
            .parse()
            .expect("E12: token id makes an invalid sub-account");

        self.tokens.insert(
            token_id.clone(),
            TokenRecord {
                vault: vault_id.clone(),
                holder: depositor.clone(),
                operator: operator.clone(),
                epoch: 1,
                created_at: env::block_timestamp(),
            },
        );
        self.total_supply += 1;

        // Refund anything above the flat mint cost.
        let surplus = deposit - MIN_MINT_DEPOSIT;
        if surplus > 0 {
            let _ = Promise::new(depositor.clone()).transfer(NearToken::from_yoctonear(surplus));
        }

        let init_args = json!({
            "controller": env::current_account_id(),
            "token_id": token_id,
            "holder": depositor,
            "operator": operator,
            "owner_key": owner_pubkey,
            "operator_key": operator_pubkey,
            "rules": rules,
        });

        Promise::new(vault_id.clone())
            .create_account()
            .transfer(NearToken::from_yoctonear(MIN_MINT_DEPOSIT))
            .deploy_contract(code)
            .add_full_access_key(owner_pubkey)
            .add_access_key_allowance(
                operator_pubkey,
                near_sdk::Allowance::limited(NearToken::from_yoctonear(OPERATOR_ALLOWANCE))
                    .unwrap_or(near_sdk::Allowance::Unlimited),
                vault_id.clone(),
                OPERATOR_METHODS.to_string(),
            )
            .function_call(
                "new".to_string(),
                init_args.to_string().into_bytes(),
                NearToken::from_yoctonear(0),
                Gas::from_tgas(80),
            )
            .then(
                Promise::new(env::current_account_id()).function_call(
                    "on_mint".to_string(),
                    json!({ "token_id": token_id, "vault_id": vault_id })
                        .to_string()
                        .into_bytes(),
                    NearToken::from_yoctonear(0),
                    Gas::from_tgas(30),
                ),
            )
    }

    /// Settlement of the mint batch. Failing loudly here would not undo the sub-account,
    /// so failure is recorded and the deposit is refunded instead.
    #[private]
    pub fn on_mint(&mut self, token_id: String, vault_id: AccountId) -> Promise {
        if env::promise_result_checked(0, 2048).is_ok() {
            Self::emit("business_minted", json!({ "token_id": token_id, "vault": vault_id }));
            return Promise::new(env::current_account_id());
        }
        // The batch failed: drop the record and give the money back to the depositor.
        if let Some(rec) = self.tokens.remove(&token_id) {
            self.total_supply = self.total_supply.saturating_sub(1);
            Self::emit(
                "mint_failed",
                json!({ "token_id": token_id, "refund_to": rec.holder }),
            );
            return Promise::new(rec.holder).transfer(NearToken::from_yoctonear(MIN_MINT_DEPOSIT));
        }
        Promise::new(env::current_account_id())
    }

    // ----------------------------------------------------------------- NEP-171

    pub fn nft_token(&self, token_id: String) -> Option<JsonToken> {
        self.tokens.get(&token_id).map(|r| JsonToken {
            token_id,
            owner_id: r.holder.clone(),
            vault: r.vault.clone(),
            operator: r.operator.clone(),
            epoch: r.epoch,
        })
    }

    pub fn nft_tokens(&self, from_index: Option<U128>, limit: Option<u64>) -> Vec<JsonToken> {
        let skip = from_index.map(|i| i.0 as usize).unwrap_or(0);
        let take = limit.unwrap_or(50) as usize;
        self.tokens
            .iter()
            .skip(skip)
            .take(take)
            .map(|(id, r)| JsonToken {
                token_id: id.clone(),
                owner_id: r.holder.clone(),
                vault: r.vault.clone(),
                operator: r.operator.clone(),
                epoch: r.epoch,
            })
            .collect()
    }

    pub fn nft_tokens_for_owner(
        &self,
        account_id: AccountId,
        from_index: Option<U128>,
        limit: Option<u64>,
    ) -> Vec<JsonToken> {
        let skip = from_index.map(|i| i.0 as usize).unwrap_or(0);
        let take = limit.unwrap_or(50) as usize;
        self.tokens
            .iter()
            .filter(|(_, r)| r.holder == account_id)
            .skip(skip)
            .take(take)
            .map(|(id, r)| JsonToken {
                token_id: id.clone(),
                owner_id: r.holder.clone(),
                vault: r.vault.clone(),
                operator: r.operator.clone(),
                epoch: r.epoch,
            })
            .collect()
    }

    pub fn nft_total_supply(&self) -> U128 {
        U128::from(self.total_supply as u128)
    }

    pub fn nft_metadata(&self) -> NFTContractMetadata {
        self.metadata.clone()
    }

    // ---------------------------------------------------------------- transfer

    /// Transfer ownership. `memo` must carry the new owner's key as `ed25519:<base58>`
    /// — the vault needs a public key to grant, not an account name.
    #[payable]
    pub fn nft_transfer(
        &mut self,
        receiver_id: AccountId,
        token_id: String,
        approval_id: Option<u64>,
        memo: Option<String>,
    ) -> Promise {
        let _ = approval_id;
        require!(
            env::attached_deposit() >= NearToken::from_yoctonear(1),
            "E15: attach 1 yoctoNEAR"
        );

        let key = memo.expect("E07: memo must carry the new owner key");
        require!(key.starts_with("ed25519:"), "E08: key must be ed25519");
        let parsed: PublicKey = key.parse().expect("E08: unparseable public key");

        let mut rec = self.tokens.get(&token_id).expect("E03: unknown token").clone();
        require!(env::predecessor_account_id() == rec.holder, "E04: not the holder");
        require!(receiver_id != rec.holder, "E09: already the holder");

        match self.rotation.get(&token_id) {
            Some(Rotation::Pending { .. }) => panic!("E06: a transfer is already settling"),
            _ => {}
        }

        let from = rec.holder.clone();
        let epoch = rec.epoch + 1;
        rec.holder = receiver_id.clone();
        rec.epoch = epoch;
        self.tokens.insert(token_id.clone(), rec.clone());

        self.rotation.insert(
            token_id.clone(),
            Rotation::Pending {
                epoch,
                from: from.clone(),
                to: receiver_id.clone(),
                key: key.clone(),
            },
        );

        Self::emit(
            "rotation_pending",
            json!({ "token_id": token_id, "from": from, "to": receiver_id, "epoch": epoch }),
        );

        self.call_set_holder(token_id, rec.vault, receiver_id, parsed, epoch)
    }

    /// Permissionless repair. Retries a failed rotation; safe to call at any time.
    #[payable]
    pub fn resolve_rotation(&mut self, token_id: String) -> Promise {
        let rec = self.tokens.get(&token_id).expect("E03: unknown token").clone();
        match self.rotation.get(&token_id).cloned() {
            Some(Rotation::Failed {
                epoch,
                to,
                key,
                ..
            }) => {
                let parsed: PublicKey = key.parse().expect("E08: unparseable public key");
                self.rotation.insert(
                    token_id.clone(),
                    Rotation::Pending {
                        epoch,
                        from: rec.holder.clone(),
                        to: to.clone(),
                        key: key.clone(),
                    },
                );
                self.call_set_holder(token_id, rec.vault, to.clone(), parsed, epoch)
            }
            _ => panic!("E16: nothing to resolve"),
        }
    }

    #[private]
    pub fn on_rotation(&mut self, token_id: String, epoch: u32) -> bool {
        // `checked` instead of `promise_result`: the unchecked read can run out of gas
        // and take the whole callback down with it.
        let ok = env::promise_result_checked(0, 2048).is_ok();
        self.settle_rotation(token_id, epoch, ok)
    }

    /// The state machine itself, separated from the promise plumbing so it can be
    /// tested without a mocked promise result.
    pub(crate) fn settle_rotation(&mut self, token_id: String, epoch: u32, ok: bool) -> bool {

        match self.rotation.get(&token_id).cloned() {
            Some(Rotation::Pending {
                from,
                to,
                key,
                epoch: pending_epoch,
            }) if pending_epoch == epoch => {
                if ok {
                    self.rotation.insert(
                        token_id.clone(),
                        Rotation::Applied {
                            epoch,
                            to: to.clone(),
                            at: env::block_timestamp(),
                        },
                    );
                    Self::emit("rotation_applied", json!({ "token_id": token_id, "to": to, "epoch": epoch }));
                } else {
                    // Compensate: hand the token back so the holder is never keyless.
                    if let Some(mut rec) = self.tokens.get(&token_id).cloned() {
                        rec.holder = from.clone();
                        rec.epoch = epoch - 1;
                        self.tokens.insert(token_id.clone(), rec);
                    }
                    self.rotation.insert(
                        token_id.clone(),
                        Rotation::Failed {
                            epoch,
                            from: from.clone(),
                            to,
                            key,
                            reason: "E17: vault rejected rotation".to_string(),
                        },
                    );
                    Self::emit("rotation_failed", json!({ "token_id": token_id, "reverted_to": from }));
                }
                ok
            }
            _ => false,
        }
    }

    // ------------------------------------------------------------------- views

    pub fn get_rotation(&self, token_id: String) -> Rotation {
        self.rotation.get(&token_id).cloned().unwrap_or(Rotation::None)
    }

    pub fn get_vault(&self, token_id: String) -> Option<AccountId> {
        self.tokens.get(&token_id).map(|r| r.vault.clone())
    }

    pub fn get_config(&self) -> near_sdk::serde_json::Value {
        json!({
            "owner_id": self.owner_id,
            "minter": self.minter,
            "mint_paused": self.mint_paused,
            "total_supply": self.total_supply,
            "min_mint_deposit": MIN_MINT_DEPOSIT.to_string(),
            "vault_code_stored": self.vault_code.get().is_some(),
        })
    }

    // ---------------------------------------------------------------- internals

    fn call_set_holder(
        &self,
        token_id: String,
        vault: AccountId,
        new_holder: AccountId,
        key: PublicKey,
        epoch: u32,
    ) -> Promise {
        Promise::new(vault)
            .function_call(
                "set_holder".to_string(),
                json!({
                    "new_holder": new_holder,
                    "new_owner_key": key,
                    "epoch": epoch,
                })
                .to_string()
                .into_bytes(),
                NearToken::from_yoctonear(ROTATION_DEPOSIT),
                Gas::from_tgas(40),
            )
            .then(
                Promise::new(env::current_account_id()).function_call(
                    "on_rotation".to_string(),
                    json!({ "token_id": token_id, "epoch": epoch })
                        .to_string()
                        .into_bytes(),
                    NearToken::from_yoctonear(0),
                    Gas::from_tgas(20),
                ),
            )
    }

    fn validate_token_id(token_id: &str) {
        require!(
            (2..=32).contains(&token_id.len()),
            "E12: token id length 2-32"
        );
        require!(
            token_id
                .chars()
                .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_'),
            "E12: token id must be [a-z0-9-_] (no dots: it becomes a sub-account)"
        );
    }

    fn emit(event: &str, data: near_sdk::serde_json::Value) {
        let payload = json!({
            "standard": "handover",
            "version": "1.0.0",
            "event": event,
            "data": [data],
        });
        env::log_str(&format!("EVENT_JSON:{payload}"));
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use near_sdk::test_utils::{VMContextBuilder, accounts};
    use near_sdk::{testing_env, VMContext};

    const NEAR_1: u128 = 1_000_000_000_000_000_000_000_000;

    fn alice() -> AccountId {
        accounts(2)
    }
    fn bob() -> AccountId {
        accounts(3)
    }

    fn key_a() -> PublicKey {
        "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"
            .parse()
            .unwrap()
    }
    fn key_b() -> PublicKey {
        "ed25519:H8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"
            .parse()
            .unwrap()
    }

    fn meta() -> NFTContractMetadata {
        NFTContractMetadata {
            spec: "nft-1.0.0".to_string(),
            name: "Handover".to_string(),
            symbol: "HNDV".to_string(),
            icon: None,
            base_uri: None,
            reference: None,
            reference_hash: None,
        }
    }

    fn rules() -> Rules {
        Rules {
            max_spend_per_epoch: U128::from(2 * NEAR_1),
            max_single_spend: U128::from(NEAR_1 / 2),
            epoch_secs: 60,
            allow_recipients: vec![],
            claim_cooldown_secs: 0,
            rules_delay_secs: 0,
        }
    }

    fn context(predecessor: AccountId, deposit: u128) -> VMContext {
        VMContextBuilder::new()
            .current_account_id("registry.testnet".parse().unwrap())
            .predecessor_account_id(predecessor)
            .attached_deposit(NearToken::from_yoctonear(deposit))
            .block_timestamp(1_000_000_000)
            .build()
    }

    fn registry() -> Registry {
        testing_env!(context(alice(), 0));
        let mut r = Registry::new(alice(), alice(), meta());
        r.store_vault_code(vec![0u8; 64]);
        r
    }

    fn minted() -> Registry {
        let mut r = registry();
        testing_env!(context(alice(), MIN_MINT_DEPOSIT));
        r.mint_business(
            "biz-1".to_string(),
            bob(),
            key_b(),
            key_a(),
            rules(),
        );
        r
    }

    #[test]
    fn mint_creates_token_and_vault_name() {
        let r = minted();
        let t = r.nft_token("biz-1".to_string()).unwrap();
        assert_eq!(t.owner_id, alice());
        assert_eq!(t.vault, "biz-1.registry.testnet".parse::<AccountId>().unwrap());
        assert_eq!(r.nft_total_supply(), U128::from(1));
    }

    #[test]
    #[should_panic(expected = "E01")]
    fn non_minter_cannot_mint() {
        let mut r = registry();
        testing_env!(context(bob(), MIN_MINT_DEPOSIT));
        let _ = r.mint_business("biz-2".to_string(), bob(), key_b(), key_a(), rules());
    }

    #[test]
    #[should_panic(expected = "E11")]
    fn mint_requires_the_deposit() {
        let mut r = registry();
        testing_env!(context(alice(), 1));
        let _ = r.mint_business("biz-2".to_string(), bob(), key_b(), key_a(), rules());
    }

    #[test]
    #[should_panic(expected = "E12")]
    fn token_id_with_a_dot_is_rejected() {
        let mut r = registry();
        testing_env!(context(alice(), MIN_MINT_DEPOSIT));
        let _ = r.mint_business("biz.1".to_string(), bob(), key_b(), key_a(), rules());
    }

    #[test]
    #[should_panic(expected = "E02")]
    fn duplicate_token_is_rejected() {
        let mut r = minted();
        testing_env!(context(alice(), MIN_MINT_DEPOSIT));
        let _ = r.mint_business("biz-1".to_string(), bob(), key_b(), key_a(), rules());
    }

    #[test]
    fn transfer_records_pending_and_advances_epoch() {
        let mut r = minted();
        testing_env!(context(alice(), 1));
        let _ = r.nft_transfer(bob(), "biz-1".to_string(), None, Some(key_b().to_string()));

        let t = r.nft_token("biz-1".to_string()).unwrap();
        assert_eq!(t.owner_id, bob());
        assert_eq!(t.epoch, 2);
        assert!(matches!(r.get_rotation("biz-1".to_string()), Rotation::Pending { epoch: 2, .. }));
    }

    #[test]
    #[should_panic(expected = "E04")]
    fn non_holder_cannot_transfer() {
        let mut r = minted();
        testing_env!(context(bob(), 1));
        let _ = r.nft_transfer(bob(), "biz-1".to_string(), None, Some(key_b().to_string()));
    }

    #[test]
    #[should_panic(expected = "E07")]
    fn transfer_without_a_key_is_rejected() {
        let mut r = minted();
        testing_env!(context(alice(), 1));
        let _ = r.nft_transfer(bob(), "biz-1".to_string(), None, None);
    }

    #[test]
    #[should_panic(expected = "E08")]
    fn transfer_with_a_non_ed25519_key_is_rejected() {
        let mut r = minted();
        testing_env!(context(alice(), 1));
        let _ = r.nft_transfer(bob(), "biz-1".to_string(), None, Some("secp256k1:abc".into()));
    }

    #[test]
    fn successful_callback_marks_applied() {
        let mut r = minted();
        testing_env!(context(alice(), 1));
        let _ = r.nft_transfer(bob(), "biz-1".to_string(), None, Some(key_b().to_string()));

        assert!(r.settle_rotation("biz-1".to_string(), 2, true));
        assert!(matches!(r.get_rotation("biz-1".to_string()), Rotation::Applied { epoch: 2, .. }));
    }

    #[test]
    fn failed_callback_reverts_the_holder() {
        let mut r = minted();
        testing_env!(context(alice(), 1));
        let _ = r.nft_transfer(bob(), "biz-1".to_string(), None, Some(key_b().to_string()));

        assert!(!r.settle_rotation("biz-1".to_string(), 2, false));

        let t = r.nft_token("biz-1".to_string()).unwrap();
        assert_eq!(t.owner_id, alice(), "holder must be restored");
        assert_eq!(t.epoch, 1);
        assert!(matches!(r.get_rotation("biz-1".to_string()), Rotation::Failed { .. }));
    }

    #[test]
    fn resolve_rotation_retries_only_after_failure() {
        let mut r = minted();
        testing_env!(context(alice(), 1));
        let _ = r.nft_transfer(bob(), "biz-1".to_string(), None, Some(key_b().to_string()));

        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            let _ = r.resolve_rotation("biz-1".to_string());
        }));
        assert!(err.is_err(), "E16: nothing to resolve while pending");
    }

    #[test]
    fn views_paginate() {
        let mut r = registry();
        for i in 1..=3 {
            testing_env!(context(alice(), MIN_MINT_DEPOSIT));
            let _ = r.mint_business(format!("biz-{i}"), bob(), key_b(), key_a(), rules());
        }
        assert_eq!(r.nft_tokens(None, None).len(), 3);
        assert_eq!(r.nft_tokens(Some(U128::from(1)), Some(1)).len(), 1);
        assert_eq!(
            r.nft_tokens_for_owner(alice(), None, None).len(),
            3,
            "all three are held by the minter"
        );
    }
}
