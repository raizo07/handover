# Submission packet

Status as of **2026-11-10**. Deadline **2026-11-14T23:59:00Z**. Nothing here is sent
until the human confirms the exact payload — the API takes one submission per repository.

---

## 1. What the submission needs

| Field | Rule | Where it comes from | State |
|---|---|---|---|
| `projectName` | 2–80 chars | HANDOVER (working title) | needs a yes |
| `leadName` | 2–80 chars | human | **missing** |
| `email` | valid, ≤160 | human | **missing** |
| `size` | `1` \| `2 - 4` \| `4 - 6` \| `6 - 8` \| `8+` | human | **missing** |
| `tracks` | ≥1 track id | proposal: `["nfts","business"]` | needs a yes |
| `nearAddress` | mainnet, lowercase | `raizo07.near` | **blocked — key not rotated** |
| `projectUrl` | public repo | https://github.com/raizo07/handover | ready |
| `demoUrl` | public post | X post by the human | **missing** |
| `idea` | 20–2000 chars | draft below | needs approval |
| `consent` | `true` | read to the human verbatim | pending |

### Why `nearAddress` is blocked

`raizo07.near` is the only mainnet account the team has, and its **only** full-access key
is the one pasted into chat on 2026-11-10. Anyone with that string can sign for the
account, which means anyone could sweep a prize paid to it.

Fix before submitting: add a new full-access key in a wallet, confirm it works, delete
`ed25519:8EJvQEEjj6sh2h8Uf5n2ZfZ12fUZwWHsrkzAFYSEuxCk`, then use the account. Or submit a
different mainnet account.

---

## 2. What else the rules require

| Rule | State |
|---|---|
| Repository public before the deadline (Q-001, step 1) | done — public since 2026-11-06 |
| README written for machine readers: what it is, the problem, "do X → see Y" | done |
| LICENSE file (Q-014) | MIT |
| Baseline / diff section (Q-003) | new repo, stated in README |
| Demo post on X: says NEAR HACKATHON, tags @NEARProtocol, `#NEARHackathon`, attaches video or screenshots | **not started** — human owns this |
| Demo must be reachable, or a video if it is not (Q-012) | hosted demo is up |
| One submission per project; one person ≤2 projects; disclose overlaps (Q-015) | single project |

---

## 3. Draft `idea` (996 chars — needs approval, not yet sent)

> When a small business is sold, the buyer inherits an operating entity — a bank account,
> suppliers, an operator who does the work — not a JPEG. HANDOVER makes that literal on
> NEAR: minting creates a real sub-account with its own treasury, a full-access owner key
> and a function-call operator key constrained by an on-chain charter (per-call cap, epoch
> cap, allowlist, halt). Revenue accrues as an unclaimed dividend that travels with the
> token. Selling rotates the vault's owner key in two confirmed beats — the registry
> settles the vault's separate receipt with a callback and can revert if the vault refuses
> — while the operator keeps trading, and the seller's deleted key means their next
> transaction fails inside nearcore. Wallets sign registry actions; the business key signs
> vault actions. Deployed on testnet with two live businesses, 32 Rust tests including four
> that deploy real wasm, and a React app that reads the chain.

---

## 4. Draft X post (human publishes; do not post on their behalf)

> Selling a small business onchain is impossible today: the buyer gets an NFT, not the
> business. At NEAR HACKATHON we built HANDOVER — the token owns a real NEAR sub-account
> with a treasury, an owner key, and an operator key limited by an onchain charter.
>
> Sell it and the vault rotates its owner key in two beats while the operator keeps
> trading. The seller's key is deleted, so their next transaction fails inside nearcore
> before any contract code runs.
>
> 32 Rust tests, live on testnet. Try it: https://raizo07.github.io/handover/
>
> What would you want the charter to be able to constrain? @NEARProtocol #NEARHackathon

Attach: a screen recording of 45 seconds following the buy flow, or the three screenshots
in `docs/screens/`. The first line must land for someone who has never heard of the
project.

---

## 5. Order of work to the deadline

1. Rotate the payout key (5 minutes, blocks the form).
2. Fill the five missing fields.
3. Record the 45-second demo and publish the post.
4. Print the JSON payload, human confirms, then `POST /api/applications` once.
5. Keep the hosted demo up until at least 2026-11-18.

Nothing technical gates the submission. The remaining risk is administrative: a missing
field or a post that does not carry the required tags.
