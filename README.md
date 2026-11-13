# FREEHOLD

**A business is a NEAR account. An NFT is the share.**

> **Live:** <https://raizo07.github.io/freehold/> · **Film:** [`film/out/freehold.mp4`](film/out/freehold.mp4) ·
> **Registry:** [`reg.raizo07.testnet`](https://testnet.nearblocks.io/address/reg.raizo07.testnet)

Two businesses are live on NEAR testnet, each a real sub-account: `biz-7.reg.raizo07.testnet`
and `biz-3.reg.raizo07.testnet`. Both contracts are tested (32 Rust tests, 4 of which deploy
real wasm into a NEAR VM).

## What it is

One token owns one sub-account holding:

- a **treasury** — money the business earns
- an **owner key** — full access, rotated on every sale
- an **operator key** — function-call scoped, held by an agent
- a **charter** — the operator's rulebook: per-call cap, per-epoch cap, allowlist, halt switch

Transfer the token and the vault rotates its owner key. The seller's key is deleted, so their
next transaction fails inside nearcore. The operator keeps trading. The buyer inherits the
unclaimed dividend.

## Why NEAR

Sub-accounts and scoped access keys are why "the asset *is* an account" is true here rather than
simulated: the split between owner and operator is enforced by the protocol, not by `if`
statements in my code.

## Try it

No wallet, no funds.

1. `make test` → `32 passed`: 13 registry, 15 vault, 4 sandbox.
2. `make demo` → `http://localhost:4173`, three businesses on seeded data.
3. Add `?live=1` on the hosted build → the badge says `TESTNET · LIVE` and the businesses come
   from chain.
4. On `/b/biz-7`: drag the cap to `0.20`, **propose change**, **apply**, then **try an
   overspend** → refused with `E20` and a receipt.
5. **halt operator** → the key is deleted; the next spend is `E23`.
6. **sell this business** → a real ed25519 key in the browser, two beats, `You own it.`
7. **reset demo data** on `/judge` restores the seed.

Every action opens a receipt with the `EVENT_JSON` the contract emits.

## Real vs simulated

| | |
|---|---|
| Contracts | **Real.** Deployed on testnet, addresses above. |
| Chain reads | **Real.** `?live=1` reads the registry through `near-kit`. |
| Wallet | **Real.** NEAR Connect signs `nft_transfer` and `resolve_rotation`. |
| Demo data | **Simulated.** Three seeded businesses, no chain calls. The banner says so. |
| Vault actions | **Simulated** in the browser: those calls need the business key. |

## Deploy

`make deploy-dry` · `make sandbox` · `make deploy`. A run needs ~12 NEAR (registry, stored
vault code, three mints at 2 NEAR) and writes `docs/DEPLOYED.md`.

**Naming note:** the deployed contracts still emit `"standard": "handover"`. The source now
says `freehold`; the change takes effect on the next deploy. That needs ~12 NEAR and the
deployer holds 0.97, so the live chain still says the old string.

## Layout

```
contracts/registry/   NEP-171 registry: mints businesses, runs the rotation state machine
contracts/vault/      the business account: treasury, keys, charter, dividends
web/                  React app (demo data by default, chain reads with ?live=1)
film/                 the demo film: plan, engine, score, render
docs/SPEC.md          state shapes, methods, events, errors, test matrix
docs/DEPLOYED.md      the addresses that are live
```

## License

MIT — see [LICENSE](LICENSE).
