//! Sandbox integration tests: the contract running in a real NEAR VM.
//!
//! These exist to prove the claims that only exist at the protocol level:
//! a call signed by another account cannot touch the treasury, and the caps hold
//! in an actual wasm execution, not just in mocked unit tests.

use near_api::{AccountId, NearGas, NearToken};
use near_sdk::serde_json::json;

const NEAR: u128 = 1_000_000_000_000_000_000_000_000;

fn rules(max_epoch: u128, max_single: u128) -> near_sdk::serde_json::Value {
    json!({
        "max_spend_per_epoch": max_epoch.to_string(),
        "max_single_spend": max_single.to_string(),
        "epoch_secs": 60,
        "allow_recipients": [],
        "claim_cooldown_secs": 0,
        "rules_delay_secs": 0,
    })
}

async fn setup() -> testresult::TestResult<(
    near_sandbox::Sandbox,
    near_api::NetworkConfig,
    std::sync::Arc<near_api::Signer>,
    near_api::Contract,
    near_api::Account,
)> {
    let sandbox = near_sandbox::Sandbox::start_sandbox().await?;
    let network = near_api::NetworkConfig::from_rpc_url("sandbox", sandbox.rpc_addr.parse()?);

    let signer = near_api::Signer::from_secret_key(
        near_sandbox::config::DEFAULT_GENESIS_ACCOUNT_PRIVATE_KEY
            .parse()
            .unwrap(),
    )?;

    let vault_id: AccountId = "vault.sandbox".parse().unwrap();
    sandbox
        .create_account(vault_id.clone())
        .initial_balance(NearToken::from_near(20))
        .send()
        .await?;

    let outsider_id: AccountId = "outsider.sandbox".parse().unwrap();
    sandbox
        .create_account(outsider_id.clone())
        .initial_balance(NearToken::from_near(5))
        .send()
        .await?;

    // A real payee: transfers to a non-existent *named* account fail on NEAR, which
    // would otherwise mask the cap assertions below.
    let vendor_id: AccountId = "vendor.sandbox".parse().unwrap();
    sandbox
        .create_account(vendor_id)
        .initial_balance(NearToken::from_near(1))
        .send()
        .await?;

    let wasm = std::fs::read(cargo_near_build::build_with_cli(Default::default())?)?;

    near_api::Contract::deploy(vault_id.clone())
        .use_code(wasm)
        .with_init_call(
            "new",
            json!({
                "controller": "registry.sandbox",
                "token_id": "biz-1",
                "holder": "holder.sandbox",
                "operator": "operator.sandbox",
                // placeholder keys: the sandbox test does not depend on them being live
                "owner_key": "ed25519:6E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtp",
                "operator_key": "ed25519:9E8sCci9badyRkXb3JoRpBj5p8C6Tw41ELDZoiihKEtr",
                "rules": rules(2 * NEAR, NEAR / 2),
            }),
        )?
        .with_signer(signer.clone())
        .send_to(&network)
        .await?
        .assert_success();

    let contract = near_api::Account(vault_id).as_contract();

    Ok((
        sandbox,
        network,
        signer,
        contract,
        near_api::Account(outsider_id),
    ))
}

#[tokio::test]
async fn deploys_initialises_and_reports_baseline() -> testresult::TestResult<()> {
    let (_sandbox, network, _signer, contract, _outsider) = setup().await?;

    let stats: near_sdk::serde_json::Value = contract
        .call_function("get_stats", ())
        .read_only()
        .fetch_from(&network)
        .await?
        .data;

    assert_eq!(stats["token_id"], "biz-1");
    assert_eq!(stats["epoch"], 1);
    assert_eq!(stats["pending_dividend"].as_str().unwrap(), "0");
    assert_eq!(stats["halted"], false);
    Ok(())
}

#[tokio::test]
async fn sale_accrues_and_outsider_cannot_claim() -> testresult::TestResult<()> {
    let (_sandbox, network, signer, contract, outsider) = setup().await?;

    // The vault's own key reports a 5 NEAR sale.
    contract
        .call_function("record_sale", json!({ "note": "coffee beans" }))
        .transaction()
        .deposit(NearToken::from_near(5))
        .with_signer(contract.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_success();

    let stats: near_sdk::serde_json::Value = contract
        .call_function("get_stats", ())
        .read_only()
        .fetch_from(&network)
        .await?
        .data;
    assert_eq!(stats["revenue_total"].as_str().unwrap(), (5 * NEAR).to_string());
    assert_eq!(
        stats["pending_dividend"].as_str().unwrap(),
        (5 * NEAR).to_string()
    );

    // A different account cannot drain the dividend, even though it knows the method name.
    contract
        .call_function("claim", ())
        .transaction()
        .gas(NearGas::from_tgas(30))
        .with_signer(outsider.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_failure();

    Ok(())
}

#[tokio::test]
async fn per_call_cap_is_enforced_in_the_vm() -> testresult::TestResult<()> {
    let (_sandbox, network, signer, contract, _outsider) = setup().await?;

    // Over the 0.5 NEAR single-spend cap.
    contract
        .call_function(
            "operator_spend",
            json!({ "to": "vendor.sandbox", "amount": (NEAR).to_string(), "purpose": "too much" }),
        )
        .transaction()
        .gas(NearGas::from_tgas(30))
        .with_signer(contract.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_failure();

    // Inside the cap.
    contract
        .call_function(
            "operator_spend",
            json!({ "to": "vendor.sandbox", "amount": (NEAR / 10).to_string(), "purpose": "restock" }),
        )
        .transaction()
        .gas(NearGas::from_tgas(30))
        .with_signer(contract.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_success();

    Ok(())
}

#[tokio::test]
async fn halt_flips_state_and_blocks_the_operator() -> testresult::TestResult<()> {
    let (_sandbox, network, signer, contract, _outsider) = setup().await?;

    contract
        .call_function("halt", ())
        .transaction()
        .gas(NearGas::from_tgas(30))
        .with_signer(contract.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_success();

    let stats: near_sdk::serde_json::Value = contract
        .call_function("get_stats", ())
        .read_only()
        .fetch_from(&network)
        .await?
        .data;
    assert_eq!(stats["halted"], true);

    contract
        .call_function(
            "operator_spend",
            json!({ "to": "vendor.sandbox", "amount": "1", "purpose": "after halt" }),
        )
        .transaction()
        .gas(NearGas::from_tgas(30))
        .with_signer(contract.account_id().clone(), signer.clone())
        .send_to(&network)
        .await?
        .assert_failure();

    Ok(())
}
