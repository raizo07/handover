#!/usr/bin/env node
/**
 * Deploy + seed FREEHOLD.
 *
 * Three modes, same code path:
 *
 *   node scripts/deploy.mjs --dry-run     plan only: accounts, wasm sizes, NEAR needed
 *   node scripts/deploy.mjs --sandbox     full rehearsal against a local NEAR node
 *   node scripts/deploy.mjs               real testnet run, reading ../.env
 *
 * Idempotent: an existing registry, stored code, or minted token is detected and skipped,
 * so a failed run can be resumed by running it again.
 *
 * What it never does: touch mainnet, print a secret key, or write a key into the repo.
 * Generated keys go to deploy-out/keys.json, which is git-ignored.
 */

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { KeyPair } from "@near-js/crypto";

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = join(HERE, "..", "..");
const OUT = join(REPO, "deploy-out");

const YOCTO_PER_NEAR = 10n ** 24n;
const MIN_MINT_DEPOSIT = "2 NEAR";
const CODE_DEPOSIT = "2 NEAR";
const REGISTRY_FUNDING = "3 NEAR";

// Same three businesses the frontend seeds, so demo and chain agree.
const BUSINESSES = [
  {
    tokenId: "biz-7",
    name: "Oja Coffee Works",
    operator: "agent-coffee",
    rules: {
      max_spend_per_epoch: yocto(2),
      max_single_spend: yocto(0.5),
      epoch_secs: 86_400,
      allow_recipients: ["supplier.coffee.testnet", "roastery.rent.testnet"],
      claim_cooldown_secs: 0,
      rules_delay_secs: 0,
    },
  },
  {
    tokenId: "biz-3",
    name: "Balogun Textiles",
    operator: "agent-textile",
    rules: {
      max_spend_per_epoch: yocto(1.2),
      max_single_spend: yocto(0.4),
      epoch_secs: 86_400,
      allow_recipients: [],
      claim_cooldown_secs: 3600,
      rules_delay_secs: 0,
    },
  },
  {
    tokenId: "biz-9",
    name: "Third Mainland Freight",
    operator: "agent-freight",
    rules: {
      max_spend_per_epoch: yocto(4),
      max_single_spend: yocto(1.5),
      epoch_secs: 21_600,
      allow_recipients: [],
      claim_cooldown_secs: 0,
      rules_delay_secs: 60,
    },
  },
];

const args = process.argv.slice(2);
const DRY = args.includes("--dry-run");
const SANDBOX = args.includes("--sandbox");
const VERBOSE = args.includes("--verbose");
const KEEP = args.includes("--keep");
const LIMIT = (() => {
  const i = args.indexOf("--businesses");
  return i >= 0 ? Number(args[i + 1]) : BUSINESSES.length;
})();

const c = {
  dim: (s) => `\x1b[2m${s}\x1b[0m`,
  bold: (s) => `\x1b[1m${s}\x1b[0m`,
  amber: (s) => `\x1b[33m${s}\x1b[0m`,
  green: (s) => `\x1b[32m${s}\x1b[0m`,
  red: (s) => `\x1b[31m${s}\x1b[0m`,
};

function yocto(near) {
  // 1e24 per NEAR; keep 6 decimal places of precision. Returned as a decimal string
  // because the contract's U128 fields are strings on the wire and BigInt cannot be
  // JSON-serialized directly.
  return ((BigInt(Math.round(near * 1e6)) * YOCTO_PER_NEAR) / 1_000_000n).toString();
}

const step = (n, msg) => console.log(`${c.dim(`[${n}]`)} ${msg}`);

function fail(msg) {
  console.error(`\n${c.red("✗")} ${msg}\n`);
  process.exit(1);
}

// ---------------------------------------------------------------- config

function loadEnvFile() {
  const p = join(REPO, ".env");
  if (!existsSync(p)) return {};
  const out = {};
  for (const line of readFileSync(p, "utf8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    out[k] = v;
  }
  return out;
}

function resolveConfig(env) {
  const deployer = env.DEPLOYER_ACCOUNT?.trim();
  const privateKey = env.DEPLOYER_PRIVATE_KEY?.trim();
  const rpcUrl = env.NEAR_RPC_URL?.trim() || "https://rpc.testnet.near.org";

  if (!deployer) fail("DEPLOYER_ACCOUNT is missing from .env — see .env.example");
  if (!privateKey) fail("DEPLOYER_PRIVATE_KEY is missing from .env — see .env.example");
  if (!privateKey.startsWith("ed25519:")) fail("DEPLOYER_PRIVATE_KEY must start with ed25519:");
  if (deployer.length === 64 && /^[0-9a-f]+$/.test(deployer)) {
    fail(
      `DEPLOYER_ACCOUNT looks like an implicit account (${deployer.slice(0, 8)}…).\n` +
        "  Implicit accounts cannot create sub-accounts, and every vault is a sub-account.\n" +
        "  Create a named account instead, e.g. handover-dev.testnet",
    );
  }
  if (!deployer.includes(".")) {
    fail(`DEPLOYER_ACCOUNT "${deployer}" is not a named testnet account (missing a dot).`);
  }

  const registryId = env.REGISTRY_ACCOUNT?.trim() || `reg.${deployer}`;
  if (registryId.length > 64) fail(`registry account "${registryId}" exceeds 64 characters`);

  return {
    deployer,
    privateKey,
    rpcUrl,
    registryId,
    networkId: env.NEAR_NETWORK?.trim() || "testnet",
  };
}

function assertArtifacts() {
  const paths = {
    registry: join(REPO, "contracts/registry/target/near/registry.wasm"),
    vault: join(REPO, "contracts/vault/target/near/vault.wasm"),
  };
  const missing = Object.entries(paths).filter(([, p]) => !existsSync(p));
  if (missing.length) {
    fail(
      `missing wasm: ${missing.map(([k]) => k).join(", ")}\n  Build them first:  make build`,
    );
  }
  return {
    registry: readFileSync(paths.registry),
    vault: readFileSync(paths.vault),
  };
}

function loadOrCreateKeys(registryId) {
  mkdirSync(OUT, { recursive: true });
  const path = join(OUT, "keys.json");
  let store = {};
  if (existsSync(path)) store = JSON.parse(readFileSync(path, "utf8"));

  for (const b of BUSINESSES) {
    const k = `${registryId}:${b.tokenId}`;
    if (!store[k]) {
      const owner = KeyPair.fromRandom("ed25519");
      const operator = KeyPair.fromRandom("ed25519");
      store[k] = {
        tokenId: b.tokenId,
        name: b.name,
        ownerSecret: owner.toString(),
        ownerPublic: owner.getPublicKey().toString(),
        operatorSecret: operator.toString(),
        operatorPublic: operator.getPublicKey().toString(),
        createdAt: new Date().toISOString(),
      };
    }
  }
  writeFileSync(path, JSON.stringify(store, null, 2), { mode: 0o600 });
  return store;
}

// ---------------------------------------------------------------- steps

/** Transactions report EXECUTED_OPTIMISTIC, which is not a final block yet. Polling is
 *  the honest way to wait for state we are about to read. */
async function waitFor(label, fn, { tries = 90, delayMs = 500 } = {}) {
  for (let i = 0; i < tries; i++) {
    const v = await fn().catch(() => null);
    if (v) return v;
    await sleep(delayMs);
  }
  fail(`timed out after ${Math.round((tries * delayMs) / 1000)}s waiting for ${label}`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function accountExists(near, id) {
  try {
    await near.rpc.getAccount(id, { finality: "final" });
    return true;
  } catch {
    return false;
  }
}

async function registryExists(near, id) {
  try {
    const cfg = await near.view(id, "get_config", {});
    return cfg ?? null;
  } catch {
    return null;
  }
}

async function createRegistry(near, cfg, wasm) {
  step(1, `creating ${c.bold(cfg.registryId)} and deploying ${(wasm.registry.length / 1024).toFixed(0)} KB`);
  // One transaction on purpose: in a CreateAccount batch the remaining actions execute as
  // the *new* account, which is what satisfies the owner check. If the batch is split, the
  // parent account has no key on the child and the deploy fails with ActorNoPermission.
  await near
    .transaction(cfg.deployer)
    .createAccount(cfg.registryId)
    .transfer(cfg.registryId, REGISTRY_FUNDING)
    .deployContract(cfg.registryId, new Uint8Array(wasm.registry))
    .functionCall(
      cfg.registryId,
      "new",
      {
        owner_id: cfg.deployer,
        minter: cfg.deployer,
        metadata: {
          spec: "nft-1.0.0",
          name: "FREEHOLD",
          symbol: "HNDV",
          icon: null,
          base_uri: null,
          reference: null,
          reference_hash: null,
        },
      },
      { gas: "100 Tgas" },
    )
    .send();
  step(1, c.green("registry deployed"));
}

async function storeVaultCode(near, cfg, wasm) {
  const config = await waitFor("registry to be readable", () => registryExists(near, cfg.registryId));

  if (config.vault_code_stored) {
    step(2, c.dim("vault code already stored — skipping"));
    return;
  }
  step(2, `storing vault wasm (${(wasm.vault.length / 1024).toFixed(0)} KB) in registry state`);
  await near.call(
    cfg.registryId,
    "store_vault_code",
    { code: Buffer.from(wasm.vault).toString("base64") },
    { attachedDeposit: CODE_DEPOSIT, gas: "150 Tgas", signerId: cfg.deployer },
  );
  await waitFor("vault code to be readable", async () => {
    const c2 = await registryExists(near, cfg.registryId);
    return c2?.vault_code_stored ? c2 : null;
  });
  step(2, c.green("vault code stored"));
}

async function seedBusinesses(near, cfg, keys) {
  const seed = BUSINESSES.slice(0, LIMIT);
  step(3, `seeding ${seed.length} of ${BUSINESSES.length} businesses`);
  for (const b of seed) {
    const existing = await near
      .view(cfg.registryId, "nft_token", { token_id: b.tokenId })
      .catch(() => null);
    if (existing) {
      step(3, c.dim(`${b.tokenId} already minted — skipping`));
      continue;
    }
    const k = keys[`${cfg.registryId}:${b.tokenId}`];
    const operatorId = `${b.operator}.${cfg.deployer}`;
    // The token's holder is the depositor (the deployer), so the owner key must be the
    // deployer's own key — otherwise the seed would hand ownership to a key nobody has.
    const ownerPublic = KeyPair.fromString(cfg.privateKey).getPublicKey().toString();
    process.stdout.write(`    ${b.tokenId} ${c.dim(b.name)} … `);
    await near.call(
      cfg.registryId,
      "mint_business",
      {
        token_id: b.tokenId,
        operator: operatorId,
        operator_pubkey: k.operatorPublic,
        owner_pubkey: ownerPublic,
        rules: b.rules,
      },
      { attachedDeposit: MIN_MINT_DEPOSIT, gas: "280 Tgas", signerId: cfg.deployer },
    );
    await waitFor(`${b.tokenId} to appear`, () =>
      near.view(cfg.registryId, "nft_token", { token_id: b.tokenId }),
    );
    console.log(c.green("minted"));
  }
}

async function verify(near, cfg) {
  step(4, "reading back from chain");
  const tokens = (await near.view(cfg.registryId, "nft_tokens", { from_index: "0", limit: 50 })) ?? [];
  if (!Array.isArray(tokens) || tokens.length === 0) fail("no tokens returned after seeding");

  const rows = [];
  for (const t of tokens) {
    let stats = null;
    try {
      stats = await near.view(t.vault, "get_stats", {});
    } catch (e) {
      rows.push({ token: t.token_id, vault: t.vault, note: `unreadable: ${e.message}` });
      continue;
    }
    let keysView = null;
    let rules = null;
    try {
      keysView = await near.view(t.vault, "get_keys", {});
      rules = await near.view(t.vault, "get_rules", {});
    } catch {
      /* reported through the row below */
    }
    rows.push({
      token: t.token_id,
      vault: t.vault,
      holder: t.owner_id,
      operator: t.operator,
      pending: stats?.pending_dividend ?? "0",
      halted: stats?.halted ?? false,
      ownerKey: keysView?.owner_key,
      operatorKey: keysView?.operator_key,
      operatorKeyLive: keysView?.operator_key_live,
      singleCap: rules?.max_single_spend,
      epochCap: rules?.max_spend_per_epoch,
    });
  }

  console.log("");
  for (const r of rows) {
    const pending = r.pending ? `${(Number(BigInt(r.pending)) / 1e24).toFixed(2)} NEAR` : "—";
    const keysOk = r.ownerKey && r.operatorKey ? c.green("2 keys") : c.red("keys unreadable");
    console.log(
      `    ${r.token.padEnd(7)} ${c.dim(r.vault.padEnd(30))} holder ${String(r.holder).padEnd(20)} ` +
        `${keysOk} · cap ${(Number(BigInt(r.singleCap ?? 0)) / 1e24).toFixed(2)}/${(Number(BigInt(r.epochCap ?? 0)) / 1e24).toFixed(2)} NEAR · unclaimed ${pending}`,
    );
  }
  return rows;
}

function writeDeployed(cfg, rows, wasm) {
  const date = new Date().toISOString();
  const lines = [
    "# Deployed addresses",
    "",
    `Generated by \`scripts/deploy.mjs\` on ${date}. Nothing here is mainnet.`,
    "",
    "| Item | Value |",
    "| --- | --- |",
    `| Network | \`${cfg.networkId}\` |`,
    `| Deployer | \`${cfg.deployer}\` |`,
    `| Registry | \`${cfg.registryId}\` |`,
    `| Registry wasm sha256 | \`${wasm.registrySha}\` |`,
    `| Vault wasm sha256 | \`${wasm.vaultSha}\` |`,
    "",
    "## Businesses",
    "",
    "| token_id | vault | holder | operator |",
    "| --- | --- | --- | --- |",
    ...rows.map((r) => `| \`${r.token}\` | \`${r.vault}\` | \`${r.holder ?? "?"}\` | \`${r.operator ?? "?"}\` |`),
    "",
    "Owner key on every vault: `" + (rows[0]?.ownerKey ?? "?") + "` (the deployer's key).",
    "Operator keys are per-business function-call keys stored in `deploy-out/keys.json`.",

    "",
    "## Point the frontend at it",
    "",
    "```",
    `VITE_REGISTRY_CONTRACT=${cfg.registryId}`,
    "```",
    "",
    "Put that in `.env` (not `.env.example`) and rebuild the web app. With it set the",
    "marketplace reads the chain instead of the demo fixtures.",
    "",
  ];
  // A sandbox run writes to deploy-out/ so it never masquerades as a real deployment.
  const target = cfg.networkId === "sandbox" ? join(OUT, "DEPLOYED.md") : join(REPO, "docs/DEPLOYED.md");
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, lines.join("\n"));
  step(5, `wrote ${c.bold(target.startsWith(REPO) ? target.slice(REPO.length + 1) : target)}`);
}

// ---------------------------------------------------------------- main

async function main() {
  console.log(`\n${c.bold("FREEHOLD")} · deploy ${DRY ? c.amber("(dry run)") : SANDBOX ? c.amber("(sandbox)") : ""}\n`);

  const wasm = assertArtifacts();
  const crypto = await import("node:crypto");
  const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");
  const wasmInfo = { registry: wasm.registry, vault: wasm.vault, registrySha: sha(wasm.registry), vaultSha: sha(wasm.vault) };

  if (DRY) {
    const env = loadEnvFile();
    const cfg = env.DEPLOYER_ACCOUNT
      ? resolveConfig(env)
      : {
          deployer: "handover-dev.testnet",
          rpcUrl: env.NEAR_RPC_URL || "https://rpc.testnet.near.org",
          registryId: "reg.handover-dev.testnet",
          networkId: "testnet",
        };
    if (!env.DEPLOYER_ACCOUNT) {
      console.log(c.amber("  no .env yet — planning with handover-dev.testnet as an example\n"));
    }
    console.log(`  registry      ${cfg.registryId}`);
    console.log(`  deployer      ${cfg.deployer}`);
    console.log(`  rpc           ${cfg.rpcUrl}`);
    console.log(`  registry wasm ${(wasm.registry.length / 1024).toFixed(0)} KB  ${c.dim(wasmInfo.registrySha.slice(0, 16))}`);
    console.log(`  vault wasm    ${(wasm.vault.length / 1024).toFixed(0)} KB  ${c.dim(wasmInfo.vaultSha.slice(0, 16))}`);
    console.log(`\n  transactions:`);
    console.log(`    1  create ${cfg.registryId} + deploy + new()        ${REGISTRY_FUNDING}`);
    console.log(`    2  store_vault_code (${(wasm.vault.length / 1024).toFixed(0)} KB state)            ${CODE_DEPOSIT}`);
    for (const b of BUSINESSES) {
      console.log(`    3  mint_business ${b.tokenId.padEnd(6)} → ${b.tokenId}.${cfg.registryId}`);
    }
    const total = 3 + 2 + 2 * BUSINESSES.length;
    console.log(`\n  funded balance needed: ${c.bold(`~${total} NEAR`)} (mint deposit is ${MIN_MINT_DEPOSIT} each)`);
    console.log(`  ${c.dim("Get testnet NEAR from a faucet; the deployer pays for every sub-account.")}\n`);
    return;
  }

  let near;
  let sandbox = null;
  let cfg;

  if (SANDBOX) {
    step(0, "starting a local sandbox (first run downloads the node binary)");
    const { Sandbox } = await import("near-kit/sandbox");
    sandbox = await Sandbox.start();
    const { Near } = await import("near-kit");
    near = new Near({
      network: { rpcUrl: sandbox.rpcUrl, networkId: "sandbox" },
      privateKey: sandbox.rootAccount.secretKey,
      defaultSignerId: sandbox.rootAccount.id,
    });
    cfg = {
      deployer: sandbox.rootAccount.id,
      privateKey: sandbox.rootAccount.secretKey,
      rpcUrl: sandbox.rpcUrl,
      registryId: `reg.${sandbox.rootAccount.id}`,
      networkId: "sandbox",
    };
    step(0, `sandbox at ${sandbox.rpcUrl} as ${cfg.deployer}`);
  } else {
    const env = loadEnvFile();
    cfg = resolveConfig(env);
    const { Near } = await import("near-kit");
    near = new Near({ network: cfg.networkId, rpcUrl: cfg.rpcUrl, privateKey: cfg.privateKey, defaultSignerId: cfg.deployer });
  }

  try {
    const existing = await registryExists(near, cfg.registryId);
    const exists = await accountExists(near, cfg.registryId);
    if (existing) {
      step(1, c.dim(`registry ${cfg.registryId} already exists — skipping creation`));
    } else if (exists) {
      fail(
        `account ${cfg.registryId} exists but has no readable contract.\n` +
          "  That is a half-finished earlier run. Redeploy onto it with:\n" +
          `  near contract deploy ${cfg.registryId} use-file contracts/registry/target/near/registry.wasm ...\n` +
          "  or delete the account and re-run this script.",
      );
    } else {
      await createRegistry(near, cfg, wasm);
    }

    await storeVaultCode(near, cfg, wasm);

    const keys = loadOrCreateKeys(cfg.registryId);
    await seedBusinesses(near, cfg, keys);
    const rows = await verify(near, cfg);
    writeDeployed(cfg, rows, wasmInfo);

    console.log(`\n${c.green("done")} — ${Math.min(LIMIT, BUSINESSES.length)} of ${BUSINESSES.length} businesses on ${cfg.networkId}`);
    console.log(`  ${c.dim("secrets for the seeded owners are in deploy-out/keys.json (git-ignored)")}\n`);
  } finally {
    if (sandbox && KEEP) {
      mkdirSync(OUT, { recursive: true });
      writeFileSync(
        join(OUT, "sandbox.json"),
        JSON.stringify({ rpcUrl: sandbox.rpcUrl, registryId: cfg.registryId }, null, 2),
      );
      console.log(`${c.amber("sandbox kept alive")} — ${sandbox.rpcUrl}`);
      console.log(`  registry: ${cfg.registryId}`);
      console.log(`  run the app against it:`);
      console.log(`    VITE_REGISTRY_CONTRACT=${cfg.registryId} VITE_RPC_URL=${sandbox.rpcUrl} npm run build`);
      console.log(`  stop it later: kill the near-sandbox process (deploy-out/sandbox.json has the url)\n`);
    } else if (sandbox) {
      await sandbox.stop();
    }
  }
}

main().catch((e) => {
  console.error(`\n${c.red("✗ deploy failed")}`);
  console.error(e?.stack ?? e);
  process.exit(1);
});
