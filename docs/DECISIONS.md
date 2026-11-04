# Decisions

One entry per non-obvious choice, with the evidence that drove it and the trigger that
would reverse it. Written for a reviewer who wants to know *why*, not just what.

---

## D1 — Regular deploy per vault, not a global contract

**Decision.** Each business gets its own `vault` deployment on its own sub-account.
**Evidence.** [Global contracts](https://docs.near.org/smart-contracts/global-contracts.md)
cost **10 NEAR per 100 KB, burnt**, versus locked storage for a regular deploy, and the
docs recommend global only for reuse across ~10+ accounts.
**Reversal trigger.** More than 10 businesses live, or measured deploy cost per vault
above 2 NEAR. Then: publish `vault` by code hash and use `UseGlobalContract`.

## D2 — Native NEAR dividends in v1, no FT

**Decision.** Revenue and dividends are native NEAR.
**Why.** NEP-141 adds `storage_deposit` bookkeeping to every claim path — a second
accounting surface for one demo. Native transfers have no registration step.
**Cost.** Real businesses invoice in stablecoins. Stated as v2 in the spec, not hidden.
**Reversal trigger.** A judge asks "can it pay in USDC" — the answer must be a roadmap
line with the exact NEP-141 methods named, not a shrug.

## D3 — Rotation is a two-beat state machine, not "atomic"

**Decision.** `Rotation::{None, Pending, Applied, Failed}` plus a permissionless
`resolve_rotation`.
**Why.** A cross-contract call on NEAR is separate receipts: if the callback panics, the
callee's committed key rotation is **not** rolled back. "Atomic transfer" would be
marketing, and wrong. The state machine makes the failure visible and repairable.
**Reversal trigger.** None. This is a protocol fact.

## D4 — Owner key is a bearer instrument, generated in the browser

**Decision.** The buy flow generates an ed25519 keypair client-side, stores it locally,
and forces a download before signing.
**Why.** The vault needs *a pubkey* to grant full access; wallets do not always expose
one for arbitrary accounts. Pretending the user's wallet key is enough would break
either the flow or the honesty.
**Consequence.** Loss of the download = loss of the business. The UI says so plainly.
**Reversal trigger.** Wallet support for exporting/delegating an account-level pubkey.

## D5 — The charter binds the operator, never the owner

**Decision.** Caps, allowlists and halt apply to the operator's function-call key. The
holder's key is unconstrained.
**Why.** An owner who cannot escape their own rulebook is a hostage, not an owner. The
sellable property is: *the business keeps running for you under rules you wrote, and
your agent cannot rob it.*
**Reversal trigger.** A use case where escrowed, holder-constrained treasuries are
required (e.g. a regulated fund) — that is a different product.

## D6 — Strictly testnet

**Decision.** No mainnet deployment, no real funds, per the hackathon's own guidance
and the human's instruction.
**Consequence.** The README's demo is reproducible by a judge with zero risk.

## D7 — Frontend stack pinned, `near-kit` treated as 0.x

**Decision.** React 19.3.1 / Vite 8.3.5 / `near-kit` 0.20.2 / `@hot-labs/near-connect`
0.12.0 / `near-connect-hooks` 1.1.6 / `@near-js/crypto` 2.5.1 — versions read from npm
on 2026-11-04.
**Why.** `near-kit` is pre-1.0; its API is checked against its own docs before each call
is written. Fallback is `near-api-js` v7, covered by an installed skill.
**Reversal trigger.** Any API mismatch that costs more than an hour.
