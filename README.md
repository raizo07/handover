# HANDOVER

**A business is a NEAR account. An NFT is the share.**

*Working name — `HANDOVER`. The rulebook a business runs under is called its **charter**;
the repo directory keeps the old name.*

> Status: **contract v1 in progress.** The vault contract is written and tested
> (15 unit + 4 sandbox tests). The registry contract, deployment and frontend do not
> exist yet. Steps below are marked `[not yet]` until the code behind them runs.
> See [docs/SPEC.md](docs/SPEC.md) for the build contract.

## The problem

When a small business is sold, the buyer does not receive a JPEG. They receive an
operating entity: a bank account, an access list, a booking calendar, a supplier
relationship, and a person (or bot) who actually does the work. On-chain, that is
impossible today — an NFT can hold a picture, and at best a treasury address, but it
cannot *be* the business. Transferring it means re-keying a multisig, re-papering the
entity, and hoping the operator keeps running while it happens.

CHARTER makes the ownership instrument and the operating account the same object.

## What it is

Minting a CHARTER token creates a real NEAR sub-account (`biz-7.charter.testnet`) holding:

- **treasury** — money it earns from sales
- **an owner key** — full access, rotated on every transfer of the NFT
- **an operator key** — function-call scoped, held by an autonomous agent, constrained
  by a rulebook (*charter*) enforced in the contract: per-call cap, per-epoch cap,
  recipient allowlist, halt switch
- **a dividend claim** — `revenue − claimed`, paid to whoever holds the NFT

Transfer the NFT and the vault rotates its owner key: the seller is locked out at the
protocol level, the buyer starts receiving dividends, and **the operator never stops
working**. You buy a going concern, not a keyring.

## Why NEAR

Named sub-accounts plus fine-grained access keys are why "the asset *is* an account" is
true rather than simulated. On a chain with a single key model and no sub-accounts, this
is a per-token proxy contract plus a trusted operator; here it is an account.

## Try it

All steps target testnet. No real funds.

1. **Run the sandbox tests** — `[not yet]`
   `make test` → the rotation, cap, halt, and dividend invariants pass, one line per
   invariant (see [docs/SPEC.md §10](docs/SPEC.md#10-test-matrix)).

2. **See the app with data, without a wallet** — `[not yet]`
   `make demo` → opens `http://localhost:5173/judge`, populated with three seeded
   businesses, banner says `DEMO DATA`. No faucet, no wallet, under 90 seconds.

3. **Watch an operator get blocked** — `[not yet]`
   On `/b/biz-7`, drag the per-epoch cap down, save, then press "replay operator" →
   the next spend fails with code `E21` (`EpochCapExceeded`), shown with the raw RPC
   receipt.

4. **Watch a business change hands** — `[not yet]`
   Press "buy" → the browser generates an owner key and forces you to download it →
   sign → the rotation settles in two confirmed beats: your key goes live, then the
   seller's key is deleted. The seller then tries to claim and gets
   `Access key does not exist`.

5. **Halt the agent** — `[not yet]`
   One click on `/b/biz-7` → the operator's function-call key is deleted, and its next
   attempt fails at the protocol level, not in app logic.

## Layout

```
contracts/charter/   NEP-171 registry + rotation state machine
contracts/vault/     per-business account: treasury, keys, charter, accounting
web/                 React + Vite app; /judge runs on committed fixtures
docs/SPEC.md         state shapes, methods, events, errors, protocol, test matrix
docs/DECISIONS.md    choices made and the trigger that would reverse each one
```

## Status

- [x] Specification, test matrix, demo script
- [x] `vault` contract — 15 unit tests + 4 sandbox tests, all green
- [ ] `charter` registry contract + rotation state machine
- [ ] Testnet deployment + seed script
- [ ] Frontend (marketplace, business page, buy flow, charter panel)
- [ ] `make demo` fixtures

## Prior work / baseline

This repository is new; there is no pre-hackathon code in it. If that changes, the
baseline commit will be tagged `pre-hackathon` and the diff linked here (Q-003).

Timeline: development window closes **2026-11-14T23:59:00Z**.

## License

MIT — see [LICENSE](LICENSE).
