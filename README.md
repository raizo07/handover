# HANDOVER

**A business is a NEAR account. An NFT is the share.**

*The rulebook a business runs under is called its **charter**. The repo directory keeps an
older name; everything user-facing says HANDOVER.*

> **Status — read this first.** The two contracts are written and tested (28 Rust tests,
> including 4 that deploy real wasm into a real NEAR VM). The frontend is built and runs on
> a local simulation of those contracts. **Nothing is deployed to testnet yet** — there is
> no live contract address in this repo, and this README does not claim one. The
> "real vs simulated" section below is exact.

![Marketplace](docs/screens/marketplace.png)

## The problem

When a small business is sold, the buyer does not receive a JPEG. They receive an operating
entity: a bank account, a supplier relationship, a booking calendar, and a person or bot who
actually does the work.

On-chain that is impossible today. An NFT can hold a picture and at best a treasury address,
but it cannot *be* the business. Selling means re-keying a multisig, re-papering the entity,
and hoping the operator keeps working while it happens.

HANDOVER makes the ownership instrument and the operating account the same object.

## What it is

One token = one real sub-account (`biz-7.<registry>.testnet`) holding:

- **a treasury** — money the business earns from sales
- **an owner key** — full access, rotated on every transfer of the NFT
- **an operator key** — function-call scoped, held by an autonomous agent, constrained by the
  charter: per-call cap, per-epoch cap, recipient allowlist, halt switch
- **a dividend claim** — `revenue − claimed`, paid to whoever holds the token

Transfer the token and the vault rotates its owner key. The seller is locked out **at the
protocol level** — their key is deleted, so their next transaction fails inside nearcore
before any contract code runs. The buyer inherits the unclaimed dividend. The operator never
stops trading.

![Business](docs/screens/business.png)

## Why NEAR

Named sub-accounts plus fine-grained access keys are why "the asset *is* an account" is true
rather than simulated. On a chain with one key model and no sub-accounts, this is a proxy
contract per token plus a trusted operator; here it is an account, and the separation between
owner and operator is enforced by the protocol rather than by `if` statements in my code.

## Try it

Requires Node 20+ and Rust stable. No wallet, no faucet, no funds.

1. **Run the contract tests**
   `make test`
   → `28 passed` across two crates: 13 registry unit tests, 15 vault unit tests, 4 sandbox
   tests that deploy the wasm and call it in a real VM.

2. **Run the app**
   `make demo` (or `cd web && npm ci && npm run dev` for the dev server)
   → opens `http://localhost:4173`: three businesses, a `DEMO DATA` banner, no wallet prompt.

3. **Watch the charter block the agent**
   On `/b/biz-7`, drag the *per-call cap* slider to about `0.20` →
   the line under it changes live to "the operator's next 0.31 NEAR payment **is rejected
   (E20)**". Press **replay operator** → the spend is rejected, a receipt drawer opens with
   the reverted call, and the activity feed records a struck-through row.

4. **Halve the cap, then spend inside it**
   Set the cap to `0.50`, press **replay operator** → the payment settles, the epoch meter
   advances. The same button, two outcomes, decided by one number.

5. **Halt the agent**
   Press **halt operator** → the receipt shows `DeleteKey(...)`. Press **replay operator**
   again → `E23`, because the key no longer exists. Press **resume** to re-arm it.

6. **Buy a business**
   Press **sell this business** on any business → generate an owner key (a real ed25519
   keypair in your browser), **download it** (the flow blocks until you do), sign →
   the rotation settles in two beats: `rotation_pending`, then `rotation_applied`, and the
   page states what the seller now sees: `Access key does not exist`.

7. **Inspect any receipt**
   Every action opens a drawer with the `EVENT_JSON` the contract emits and the action list.
   No number in the UI is unexplained.

## Deploy (written, rehearsed, not yet run on testnet)

The deploy script is idempotent and has three modes:

```
make deploy-dry      # print the plan: accounts, wasm hashes, NEAR needed
make deploy-sandbox  # full rehearsal against a local NEAR node
make deploy          # real testnet run, reading .env
```

The sandbox rehearsal is the one I have executed: it deploys the registry (214 KB), stores
the vault wasm in registry state (162 KB), mints three businesses — each a real sub-account
with a vault, a full-access owner key and a function-call operator key — then reads all of it
back. Pointing the app at that node with `VITE_REGISTRY_CONTRACT` renders the same data from
chain:

![Live mode](docs/screens/live.png)

A testnet run needs a funded named account (about 25 NEAR covers the registry plus three
mints) and writes `docs/DEPLOYED.md` with the real addresses. It will not run against
mainnet, and it refuses an implicit 64-character account up front — sub-accounts require a
named parent.

## Real vs simulated (exact)

| Thing | State |
|---|---|
| `registry` + `vault` contracts | **Real.** Built with `cargo near build`, 28 tests green. |
| Key rotation, caps, halt, dividends | **Real** in Rust; **re-enforced** in the demo client so the UI cannot show a state the contract forbids. |
| Browser app | **Real** React/Vite build, served from `dist/`. |
| Chain reads in the browser | **Verified.** Set `VITE_REGISTRY_CONTRACT` (and `VITE_RPC_URL` for a local node) and the app reads the registry through `near-kit`. Rehearsed end-to-end against a local NEAR node: three businesses, real operator accounts, no demo banner. |
| Chain writes in the browser | **Not wired.** Writes show "needs a connected wallet" instead of pretending. |
| Deployed contracts | **None still.** The deploy script is written, rehearsed on a local node, and has not been run against testnet yet — so no address in this repository is live. |

The demo client enforces `E20` (per-call cap), `E21` (epoch cap), `E22` (allowlist), `E23`
(halted), `E27` (claim cooldown), `E28` (nothing to claim), `E29` (rules timelock) and `E32`
(invalid rules) with the same checks as the Rust. It is a simulation of a mechanism, not an
animation of one.

## Layout

```
contracts/registry/   NEP-171 tokens + the two-beat transfer state machine
contracts/vault/      per-business account: treasury, keys, charter, accounting
web/                  React + Vite app; demo client mirrors the contract rules
web/scripts/          headless browser checks (screenshots, buy flow)
docs/SPEC.md          state shapes, methods, events, errors, protocol, test matrix
docs/DECISIONS.md     choices and the trigger that would reverse each one
docs/DEMO.md          45-second recording script + judge walkthrough
```

## Contract invariants (asserted in tests)

| | Invariant |
|---|---|
| I1 | `vault.holder == token.holder` whenever a rotation is `Applied` |
| I2 | exactly one full-access key on a vault at rest |
| I3 | `claimed_total <= revenue_total`, always |
| I4 | `spent_epoch <= max_spend_per_epoch` after every accepted spend |
| I5 | a failed rotation restores the seller as holder |
| I6 | only `set_holder` mutates vault keys |

## Prior work / baseline

New repository. If any code predates the hackathon window it will be tagged `pre-hackathon`
and the diff linked here (Q-003). Dependencies are stock: `near-sdk`, React, Vite; the hand
written code is this repository's own.

## License

MIT — see [LICENSE](LICENSE).
