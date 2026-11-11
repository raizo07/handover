# Submission packet

Status as of **2026-11-10**. Deadline **2026-11-14T23:59:00Z**. Nothing here is sent
until the human confirms the exact payload — the API takes one submission per repository.

---

## 1. What the submission needs

| Field | Rule | Where it comes from | State |
|---|---|---|---|
| `projectName` | 2–80 chars | `HANDOVER` | **confirmed** |
| `leadName` | 2–80 chars | `Gabriel Agada` | **confirmed** |
| `email` | valid, ≤160 | `agadaraizo@gmail.com` | **confirmed** |
| `size` | `1` \| `2 - 4` \| `4 - 6` \| `6 - 8` \| `8+` | `1` | **confirmed** |
| `tracks` | ≥1 track id | `["nfts","business"]` | **confirmed** |
| `nearAddress` | mainnet, lowercase | `raizo007.near` | **confirmed** |
| `projectUrl` | public repo | https://github.com/raizo07/handover | ready |
| `demoUrl` | public post | X post by the human | **missing** |
| `idea` | 20–2000 chars | draft below | needs approval |
| `consent` | `true` | read to the human verbatim | pending |

The payload is drafted in `deploy-out/submission.json` (git-ignored — it holds personal
data). Validate it, never send it from here:

```
node scripts/prepare-submission.mjs
```

It checks every field against the published rules, refuses a non-lowercase or malformed
account, rejects a stray `website` key, reports the byte size against the 12000-byte limit,
prints the body and the curl command, and persists the `requestId` so a retry reuses it.
Current state: **2 fields outstanding** — `demoUrl`, `consent`.

### 1.1 Payout account

`raizo007.near` (two zeros) exists on mainnet, holds 0 NEAR, and its only key is
`ed25519:DxC5pLY2AhhKLmyR9UZAvfMJUgTftFdFwBkfH5caBgn6`. That key has never been in this
chat, so this account is safe to use as the payout address.

A **different** account, `raizo07.near` (one zero), exists and its only key is
`ed25519:8EJvQEEjj6sh2h8Uf5n2ZfZ12fUZwWHsrkzAFYSEuxCk` — the key pasted into chat on
2026-11-10. It is not the payout address, so no prize is exposed. Treat it as burned:
never reuse it, and rotate or abandon it.

If the payout ever moves back to a fresh account, the hackathon is explicit that the team
creates it and an agent must never create or invent one:

**Option A — a fresh account (recommended).** Create a new mainnet account in a wallet
(e.g. `handover-prize.near`), record its name, and submit that. The compromised key never
touches the payout address. Cost: whatever the wallet charges to register the name.

**Option B — rotate `raizo07.near`.** Keeps the name, but the account needs ~0.1 NEAR of
mainnet funds for gas and key storage first, then:

```
near account add-key raizo07.near grant-full-access \
  use-manually-provided-public-key <NEW_PUBKEY> network-config mainnet sign-with-keychain send

near account delete-key raizo07.near public-key ed25519:8EJvQEEjj6sh2h8Uf5n2ZfZ12fUZwWHsrkzAFYSEuxCk \
  network-config mainnet sign-with-keychain send
```

Verify the new key works before deleting the old one, or the account is lost.

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

## 4. Demo post (human publishes; never posted on their behalf)

Single post, 273 characters with the link weighted as X counts it (limit 280):

> Selling a small business onchain gives the buyer a JPEG, not the business.
>
> At NEAR HACKATHON I built HANDOVER: the token owns a real NEAR sub-account. Sell it and
> the owner key rotates while the operator keeps trading.
>
> https://raizo07.github.io/handover/ @NEARProtocol #NEARHackathon

Attach the 45-second screen recording if there is one; otherwise attach
`docs/screens/settled.png` and `docs/screens/business.png`. The post must contain
`#NEARHackathon`, `@NEARProtocol`, and the words NEAR HACKATHON — it does.

Longer version, if a thread or a premium account is used:

> A small business sold onchain gives the buyer a JPEG, not the business. No treasury, no
> operator, no customers.
>
> At NEAR HACKATHON I built HANDOVER. Minting a business creates a real NEAR sub-account
> with its own treasury, a full-access owner key, and an operator key that an agent can
> use only inside caps written onchain.
>
> The moment that matters: sell the token, and the vault rotates the owner key in two
> confirmed beats while the operator keeps trading. The seller's key is deleted, so their
> next transaction fails inside nearcore before a line of contract code runs.
>
> 32 Rust tests. Live on testnet.
> https://raizo07.github.io/handover/
>
> @NEARProtocol #NEARHackathon

---

## 5. Order of work to the deadline

1. Rotate the payout key (5 minutes, blocks the form).
2. Fill the five missing fields.
3. Record the 45-second demo and publish the post.
4. Print the JSON payload, human confirms, then `POST /api/applications` once.
5. Keep the hosted demo up until at least 2026-11-18.

Nothing technical gates the submission. The remaining risk is administrative: a missing
field or a post that does not carry the required tags.

---

## 6. Demo video

`film/out/handover.mp4` — 120 s, 1920×1080, 30 fps, H.264 + AAC at −14 LUFS. Rebuild with
`make film` (see `film/README.md`). Attach it to the post; if X rejects the size, the three
stills in `docs/screens/` are the fallback.
