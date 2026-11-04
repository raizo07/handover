//! Handover vault — one deployment per business, on a sub-account of the registry.
//!
//! Authority model (this is the whole design, so it is stated once, here):
//!
//! * `set_holder` is the only method the registry may call. It rotates the owner key
//!   and nothing else.
//! * Every other method must be signed by a key **of this account**. The protocol's
//!   access-key scoping is what separates the two human roles: the holder's key is
//!   `FullAccess`, the operator's key is `FunctionCall` limited to
//!   `record_sale` + `operator_spend`. The contract never trusts a caller identity
//!   string, because it cannot: both roles sign as this account.
//! * Therefore `halt()` is a *protocol-level* kill switch. It deletes the operator's
//!   key, so the agent cannot transact at all — not because a flag was checked, but
//!   because its signature is no longer valid.

use near_sdk::json_types::U128;
use near_sdk::serde_json::json;
use near_sdk::{env, near, require, AccountId, NearToken, PanicOnDefault, Promise, PublicKey};

const NS_PER_SEC: u64 = 1_000_000_000;
/// Gas allowance granted to the operator's function-call key (spent from this account).
const OPERATOR_ALLOWANCE: u128 = 500_000_000_000_000_000_000_000; // 0.5 NEAR
/// Conservative reserve kept for storage when computing spendable treasury.
const STORAGE_RESERVE: u128 = 300_000_000_000_000_000_000_000; // 0.3 NEAR

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

#[near(serializers = [json])]
pub struct Stats {
    pub token_id: String,
    pub holder: AccountId,
    pub operator: AccountId,
    pub halted: bool,
    pub epoch: u32,
    pub revenue_total: U128,
    pub claimed_total: U128,
    pub pending_dividend: U128,
    pub spent_epoch: U128,
    pub epoch_start: u64,
    pub treasury_estimate: U128,
    pub last_claim_at: u64,
    pub created_at: u64,
}

#[near(serializers = [json])]
pub struct KeysView {
    pub owner_key: PublicKey,
    pub operator_key: PublicKey,
    pub operator_key_live: bool,
}

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Vault {
    controller: AccountId,
    token_id: String,
    holder: AccountId,
    operator: AccountId,
    owner_key: PublicKey,
    operator_key: PublicKey,
    rules: Rules,
    epoch: u32,
    halted: bool,
    revenue_total: u128,
    claimed_total: u128,
    last_claim_at: u64,
    spent_epoch: u128,
    epoch_start: u64,
    created_at: u64,
    pending_rules: Option<(Rules, u64)>,
}

#[near]
impl Vault {
    /// Called by the registry as the last action of the sub-account creation batch.
    /// The registry adds the account's keys in that same batch (`AddKey` actions), so
    /// this method must not be what makes the account usable.
    #[init]
    pub fn new(
        controller: AccountId,
        token_id: String,
        holder: AccountId,
        operator: AccountId,
        owner_key: PublicKey,
        operator_key: PublicKey,
        rules: Rules,
    ) -> Self {
        Self::validate_rules(&rules);
        Self {
            controller,
            token_id,
            holder,
            operator,
            owner_key,
            operator_key,
            rules,
            epoch: 1,
            halted: false,
            revenue_total: 0,
            claimed_total: 0,
            last_claim_at: 0,
            spent_epoch: 0,
            epoch_start: env::block_timestamp(),
            created_at: env::block_timestamp(),
            pending_rules: None,
        }
    }

    // ---------------------------------------------------------------- registry

    /// Rotate the owner key. The operator key is deliberately untouched: the business
    /// keeps running through the change of hands.
    #[payable]
    pub fn set_holder(
        &mut self,
        new_holder: AccountId,
        new_owner_key: PublicKey,
        epoch: u32,
    ) -> Promise {
        require!(
            env::predecessor_account_id() == self.controller,
            "E24: only the registry may rotate ownership"
        );
        require!(epoch > self.epoch, "E25: stale epoch");
        require!(new_holder != self.holder, "E25: already the holder");

        let old_key = self.owner_key.clone();
        self.holder = new_holder.clone();
        self.owner_key = new_owner_key.clone();
        self.epoch = epoch;

        Self::emit(
            "ownership_rotated",
            json!({
                "token_id": self.token_id,
                "to": new_holder,
                "epoch": epoch,
                "owner_key": new_owner_key.to_string(),
            }),
        );

        // One batch on self: drop the seller's key, grant the buyer's.
        Promise::new(env::current_account_id())
            .delete_key(old_key)
            .add_full_access_key(new_owner_key)
    }

    // ---------------------------------------------------------------- operator

    /// Report a sale. The money is the attached deposit; the note is for the feed.
    #[payable]
    pub fn record_sale(&mut self, note: String) {
        self.require_self_signed();
        let amount = env::attached_deposit().as_yoctonear();
        require!(amount > 0, "E19: attach the sale proceeds");
        self.roll_epoch();
        self.revenue_total += amount;

        Self::emit(
            "sale",
            json!({
                "token_id": self.token_id,
                "amount": amount.to_string(),
                "note": note,
                "revenue_total": self.revenue_total.to_string(),
            }),
        );
    }

    /// Spend from the treasury under the charter. Fails closed on every dimension.
    pub fn operator_spend(&mut self, to: AccountId, amount: U128, purpose: String) -> Promise {
        self.require_self_signed();
        require!(!self.halted, "E23: operator is halted");
        self.roll_epoch();

        let amount = amount.0;
        require!(amount > 0, "E18: zero spend");
        require!(
            amount <= self.rules.max_single_spend.0,
            "E20: exceeds per-call cap"
        );
        require!(
            self.spent_epoch + amount <= self.rules.max_spend_per_epoch.0,
            "E21: exceeds epoch cap"
        );
        if !self.rules.allow_recipients.is_empty() {
            require!(
                self.rules.allow_recipients.contains(&to),
                "E22: recipient not allowed"
            );
        }

        self.spent_epoch += amount;

        Self::emit(
            "operator_spend",
            json!({
                "token_id": self.token_id,
                "to": to,
                "amount": amount.to_string(),
                "purpose": purpose,
                "spent_epoch": self.spent_epoch.to_string(),
            }),
        );

        Promise::new(to).transfer(NearToken::from_yoctonear(amount))
    }

    /// Kill switch: delete the operator's access key. The agent stops existing to the
    /// chain, not just in application logic.
    pub fn halt(&mut self) {
        self.require_self_signed();
        require!(!self.halted, "E23: already halted");
        self.halted = true;

        Self::emit(
            "operator_halted",
            json!({ "token_id": self.token_id, "operator_key": self.operator_key.to_string() }),
        );

        Promise::new(env::current_account_id()).delete_key(self.operator_key.clone());
    }

    /// Re-arm the operator with a new function-call key.
    pub fn resume(&mut self, operator_key: PublicKey) {
        self.require_self_signed();
        require!(self.halted, "E33: operator is not halted");
        self.halted = false;
        self.operator_key = operator_key.clone();

        Self::emit(
            "operator_resumed",
            json!({ "token_id": self.token_id, "operator_key": operator_key.to_string() }),
        );

        Promise::new(env::current_account_id()).add_access_key(
            operator_key,
            NearToken::from_yoctonear(OPERATOR_ALLOWANCE),
            env::current_account_id(),
            OPERATOR_METHODS.to_string(),
        );
    }

    // ------------------------------------------------------------------ holder

    /// Pay out everything the business has earned and not yet paid.
    pub fn claim(&mut self) -> Promise {
        self.require_self_signed();
        let pending = self.revenue_total - self.claimed_total;
        require!(pending > 0, "E28: nothing to claim");

        // A brand-new vault has never paid out, so the cooldown starts from the first
        // claim — otherwise a business created a minute ago could not pay its owner.
        if self.last_claim_at > 0 {
            let cooldown_ns = self.rules.claim_cooldown_secs.saturating_mul(NS_PER_SEC);
            require!(
                env::block_timestamp() >= self.last_claim_at + cooldown_ns,
                "E27: claim cooldown"
            );
        }

        // State first, transfer second: no reentrancy window.
        self.claimed_total += pending;
        self.last_claim_at = env::block_timestamp();
        let to = self.holder.clone();

        Self::emit(
            "dividend",
            json!({
                "token_id": self.token_id,
                "holder": to,
                "amount": pending.to_string(),
                "claimed_total": self.claimed_total.to_string(),
            }),
        );

        Promise::new(to).transfer(NearToken::from_yoctonear(pending))
    }

    /// Move money that is *not* earmarked as unclaimed dividend.
    pub fn withdraw_treasury(&mut self, to: AccountId, amount: U128) -> Promise {
        self.require_self_signed();
        require!(amount.0 <= self.spendable(), "E31: exceeds free treasury");

        Self::emit(
            "treasury_withdraw",
            json!({ "token_id": self.token_id, "to": to, "amount": amount.0.to_string() }),
        );

        Promise::new(to).transfer(NearToken::from_yoctonear(amount.0))
    }

    // ------------------------------------------------------------------- rules

    pub fn propose_rules(&mut self, rules: Rules) {
        self.require_self_signed();
        Self::validate_rules(&rules);
        self.pending_rules = Some((rules, env::block_timestamp()));

        Self::emit("rules_proposed", json!({ "token_id": self.token_id }));
    }

    pub fn apply_rules(&mut self) {
        self.require_self_signed();
        let (rules, proposed_at) = self.pending_rules.clone().expect("E30: no pending rules");

        let delay = self.rules.rules_delay_secs.saturating_mul(NS_PER_SEC);
        require!(
            env::block_timestamp() >= proposed_at + delay,
            "E29: rules are timelocked"
        );

        self.rules = rules;
        self.pending_rules = None;
        Self::emit("rules_applied", json!({ "token_id": self.token_id }));
    }

    pub fn cancel_pending_rules(&mut self) {
        self.require_self_signed();
        self.pending_rules = None;
        Self::emit("rules_cancelled", json!({ "token_id": self.token_id }));
    }

    // ------------------------------------------------------------------- views

    pub fn get_stats(&self) -> Stats {
        Stats {
            token_id: self.token_id.clone(),
            holder: self.holder.clone(),
            operator: self.operator.clone(),
            halted: self.halted,
            epoch: self.epoch,
            revenue_total: U128::from(self.revenue_total),
            claimed_total: U128::from(self.claimed_total),
            pending_dividend: self.pending_dividend(),
            spent_epoch: U128::from(self.spent_epoch),
            epoch_start: self.epoch_start,
            treasury_estimate: U128::from(self.spendable()),
            last_claim_at: self.last_claim_at,
            created_at: self.created_at,
        }
    }

    pub fn get_rules(&self) -> Rules {
        self.rules.clone()
    }

    pub fn get_pending_rules(&self) -> Option<(Rules, u64)> {
        self.pending_rules.clone()
    }

    pub fn get_keys(&self) -> KeysView {
        KeysView {
            owner_key: self.owner_key.clone(),
            operator_key: self.operator_key.clone(),
            operator_key_live: !self.halted,
        }
    }

    pub fn pending_dividend(&self) -> U128 {
        U128::from(self.revenue_total - self.claimed_total)
    }

    pub fn get_controller(&self) -> AccountId {
        self.controller.clone()
    }

    // ---------------------------------------------------------------- internals

    /// Everything here is signed by a key of this account; which key is enforced by the
    /// protocol, not by us. See the module comment.
    fn require_self_signed(&self) {
        require!(
            env::predecessor_account_id() == env::current_account_id(),
            "E26: must be signed by a key of this vault"
        );
    }

    fn roll_epoch(&mut self) {
        let window = self.rules.epoch_secs.saturating_mul(NS_PER_SEC);
        if env::block_timestamp() >= self.epoch_start + window {
            self.epoch_start = env::block_timestamp();
            self.spent_epoch = 0;
        }
    }

    fn spendable(&self) -> u128 {
        env::account_balance()
            .as_yoctonear()
            .saturating_sub(self.revenue_total - self.claimed_total)
            .saturating_sub(STORAGE_RESERVE)
    }

    fn validate_rules(rules: &Rules) {
        require!(
            rules.max_single_spend.0 > 0,
            "E32: max_single_spend must be > 0"
        );
        require!(
            rules.max_single_spend.0 <= rules.max_spend_per_epoch.0,
            "E32: single cap above epoch cap"
        );
        require!(rules.epoch_secs > 0, "E32: epoch_secs must be > 0");
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
    use near_sdk::testing_env;

    const NEAR_1: u128 = 1_000_000_000_000_000_000_000_000;

    fn alice() -> AccountId {
        accounts(2)
    }
    fn bob() -> AccountId {
        accounts(3)
    }
    fn agent() -> AccountId {
        accounts(4)
    }
    fn vendor() -> AccountId {
        accounts(5)
    }

    fn owner_key() -> PublicKey {
        "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"
            .parse()
            .unwrap()
    }
    fn op_key() -> PublicKey {
        "ed25519:9E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtr"
            .parse()
            .unwrap()
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

    fn ctx(timestamp_secs: u64, predecessor: &str) -> VMContextBuilder {
        let mut b = VMContextBuilder::new();
        b.current_account_id("biz-1.registry.testnet".parse().unwrap())
            .predecessor_account_id(predecessor.parse().unwrap())
            .block_timestamp(timestamp_secs * NS_PER_SEC);
        b
    }

    fn as_vault_self(timestamp_secs: u64) {
        testing_env!(ctx(timestamp_secs, "biz-1.registry.testnet").build());
    }

    fn as_registry(timestamp_secs: u64) {
        testing_env!(ctx(timestamp_secs, "registry.testnet").build());
    }

    fn as_outsider(timestamp_secs: u64) {
        testing_env!(ctx(timestamp_secs, &bob().to_string()).build());
    }

    fn deposit(yocto: u128) {
        testing_env!(
            ctx(1_000, "biz-1.registry.testnet")
                .attached_deposit(NearToken::from_yoctonear(yocto))
                .build()
        );
    }

    fn vault() -> Vault {
        vault_with(rules())
    }

    fn vault_with(rules: Rules) -> Vault {
        testing_env!(ctx(1_000, "biz-1.registry.testnet").build());
        Vault::new(
            "registry.testnet".parse().unwrap(),
            "biz-1".to_string(),
            alice(),
            agent(),
            owner_key(),
            op_key(),
            rules,
        )
    }

    #[test]
    fn new_sets_baseline() {
        let v = vault();
        assert_eq!(v.get_stats().epoch, 1);
        assert_eq!(v.pending_dividend(), U128::from(0));
        assert!(v.get_keys().operator_key_live);
        assert_eq!(
            v.get_controller(),
            "registry.testnet".parse::<AccountId>().unwrap()
        );
    }

    #[test]
    fn record_sale_accrues_dividend() {
        let mut v = vault();
        deposit(5 * NEAR_1);
        v.record_sale("coffee beans".to_string());

        assert_eq!(v.get_stats().revenue_total, U128::from(5 * NEAR_1));
        assert_eq!(v.pending_dividend(), U128::from(5 * NEAR_1));
    }

    #[test]
    #[should_panic(expected = "E21")]
    fn operator_spend_over_epoch_cap_is_rejected() {
        let mut v = vault();
        as_vault_self(1_000);
        for _ in 0..4 {
            v.operator_spend(vendor(), U128::from(NEAR_1 / 2), "x".into())
                .detach();
        }
        v.operator_spend(vendor(), U128::from(1), "one yocto over".into())
            .detach();
    }

    #[test]
    #[should_panic(expected = "E20")]
    fn operator_spend_over_single_cap_is_rejected() {
        let mut v = vault();
        as_vault_self(1_000);
        v.operator_spend(vendor(), U128::from(NEAR_1 / 2 + 1), "x".into())
            .detach();
    }

    #[test]
    fn epoch_window_resets_the_meter() {
        let mut v = vault();
        as_vault_self(1_000);
        v.operator_spend(vendor(), U128::from(NEAR_1 / 2), "a".into())
            .detach();
        v.operator_spend(vendor(), U128::from(NEAR_1 / 2), "b".into())
            .detach();
        assert_eq!(v.get_stats().spent_epoch, U128::from(NEAR_1));

        // step past the 60s window: the meter must clear
        as_vault_self(1_061);
        v.operator_spend(vendor(), U128::from(NEAR_1 / 2), "c".into())
            .detach();
        assert_eq!(v.get_stats().spent_epoch, U128::from(NEAR_1 / 2));
    }

    #[test]
    fn allowlist_is_enforced_when_set() {
        let mut r = rules();
        r.allow_recipients = vec![vendor()];
        let mut v = vault_with(r);

        as_vault_self(1_000);
        v.operator_spend(vendor(), U128::from(1), "ok".into())
            .detach();
        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            v.operator_spend(bob(), U128::from(1), "nope".into())
        }));
        assert!(err.is_err(), "E22: recipient not allowed");
    }

    #[test]
    fn halt_blocks_spending_and_resume_restores_it() {
        let mut v = vault();
        as_vault_self(1_000);
        v.halt();
        assert!(v.get_stats().halted);
        assert!(!v.get_keys().operator_key_live);

        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
            v.operator_spend(vendor(), U128::from(1), "x".into())
        }));
        assert!(err.is_err(), "E23: operator is halted");

        as_vault_self(1_001);
        v.resume(op_key());
        assert!(!v.get_stats().halted);
        v.operator_spend(vendor(), U128::from(1), "back".into())
            .detach();
    }

    #[test]
    fn claim_pays_pending_and_never_double_counts() {
        let mut v = vault();
        deposit(3 * NEAR_1);
        v.record_sale("sale".to_string());

        as_vault_self(1_100);
        v.claim().detach();
        assert_eq!(v.get_stats().claimed_total, U128::from(3 * NEAR_1));
        assert_eq!(v.pending_dividend(), U128::from(0));

        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| v.claim()));
        assert!(err.is_err(), "E28: nothing to claim");
    }

    #[test]
    fn claim_cooldown_starts_after_the_first_claim() {
        let mut r = rules();
        r.claim_cooldown_secs = 3600;
        let mut v = vault_with(r);

        deposit(NEAR_1);
        v.record_sale("s".to_string());

        // first claim is never blocked by the cooldown
        as_vault_self(1_010);
        v.claim().detach();

        deposit(NEAR_1);
        v.record_sale("s2".to_string());

        as_vault_self(1_030);
        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| v.claim()));
        assert!(err.is_err(), "E27: claim cooldown");
    }

    #[test]
    fn registry_rotates_owner_key_and_keeps_operator() {
        let mut v = vault();
        let new_owner_key: PublicKey = "ed25519:H8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"
            .parse()
            .unwrap();
        as_registry(1_050);
        v.set_holder(bob(), new_owner_key.clone(), 2);

        let stats = v.get_stats();
        assert_eq!(stats.holder, bob());
        assert_eq!(stats.epoch, 2);
        assert_eq!(v.get_keys().owner_key, new_owner_key);
        assert!(
            v.get_keys().operator_key_live,
            "operator must survive the transfer"
        );
    }

    #[test]
    #[should_panic(expected = "E24")]
    fn non_registry_cannot_rotate_ownership() {
        let mut v = vault();
        as_outsider(1_050);
        let k: PublicKey = "ed25519:H8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"
            .parse()
            .unwrap();
        v.set_holder(bob(), k, 2);
    }

    #[test]
    #[should_panic(expected = "E25")]
    fn stale_epoch_is_rejected() {
        let mut v = vault();
        as_registry(1_050);
        let k: PublicKey = "ed25519:H8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp"
            .parse()
            .unwrap();
        v.set_holder(bob(), k, 1);
    }

    #[test]
    #[should_panic(expected = "E26")]
    fn outsider_cannot_claim() {
        let mut v = vault();
        as_outsider(1_100);
        v.claim();
    }

    #[test]
    fn rules_are_timelocked() {
        let mut r = rules();
        r.rules_delay_secs = 100;
        let mut v = vault_with(r);

        let mut tighter = rules();
        tighter.max_spend_per_epoch = U128::from(1);
        tighter.max_single_spend = U128::from(1);

        as_vault_self(1_100);
        v.propose_rules(tighter);

        as_vault_self(1_150);
        let err = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| v.apply_rules()));
        assert!(err.is_err(), "E29: rules are timelocked");

        as_vault_self(1_250);
        v.apply_rules();
        assert_eq!(v.get_rules().max_spend_per_epoch, U128::from(1));
    }

    #[test]
    #[should_panic(expected = "E32")]
    fn invalid_rules_are_rejected() {
        let mut r = rules();
        r.max_single_spend = U128::from(2 * NEAR_1 + 1);
        vault_with(r);
    }
}
