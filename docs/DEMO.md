# Demo script

Two versions: the 45-second recording for X, and the walkthrough a judge follows with a
clean clone. Both are written as `do X → see Y`, because that is what gets verified.

---

## A. The 45-second recording

Record at 1440×900, browser zoom 100%, no music, no intro card. Voice-over optional;
captions only. One continuous take, no cuts except the two marked ones.

| t | Do | See |
|---|---|---|
| 0:00 | Land on `/b/biz-7` (a coffee roaster) | Treasury `12.4 NEAR`, operator pulse: *sold 2 bags, 3s ago* |
| 0:05 | Press **replay operator** | A `record_sale` line lands, treasury ticks up, chart grows one bar |
| 0:12 | Drag **per-epoch cap** from 2 NEAR to 0.4 NEAR, save | Timelock shows 0s on testnet; the cap row commits |
| 0:18 | Press **replay operator** again | The spend is struck through with `E21 EpochCapExceeded`; a drawer opens with the raw RPC receipt. *Nothing moved.* |
| 0:26 | Press **buy**; keep the generated key, click download | Key fingerprint appears; the confirm button was disabled until the file existed |
| 0:32 | Sign | **Two beats**: `rotation_pending` → key live; then `rotation_applied` → seller key deleted |
| 0:38 | Treasury card now shows *your* dividend (the accrued `revenue − claimed`), press claim | Money lands in the buyer's account |
| 0:42 | Switch to the seller's session, press claim | `Access key does not exist` — at the protocol level |

**Cut 1 (optional, 2s):** from the seller's error back to the operator panel, where the
agent is still selling. That is the product sentence: *it changed hands and never
paused.*

**Caption to say out loud at 0:38:** "the business kept its money, its operator and its
customers; only the key changed."

---

## B. Judge walkthrough (clean clone → verified in 2 minutes)

Prereqs: Node 20+, Rust stable, no wallet, no faucet.

1. **`cp .env.example .env && make demo`**
   → app opens at `http://localhost:5173/judge`, banner `DEMO DATA`, three businesses
   rendered with history.

2. **Open `/b/biz-7`**
   → treasury, dividend, revenue chart, operator feed all populated from
   `web/fixtures/biz-7.json`.

3. **`make test`**
   → prints one line per invariant: `I1 rotation settles holder==vault.holder … ok`,
   `I2 exactly one full-access key … ok`, … `I6 only set_holder mutates keys … ok`.

4. **Click any number on the page**
   → drawer shows the source: contract method + args + the RPC response it came from.
   Nothing in the UI is unexplained.

5. **Press "run live"**
   → same components, real testnet contract from `.env`. If RPC is down, the banner
   says so instead of faking numbers.

6. **`make deploy`** (optional, needs `.env`)
   → prints the real contract ids and the measured storage cost per business.

---

## C. What the video must *not* do

- No architecture slides. The contract appears only as a raw receipt drawer.
- No "powered by NEAR" voice line. The NEAR-ness is that a human just deleted an access
  key and an agent stopped working.
- No mocked errors. Every rejection shown is a real failed transaction with a real code.
- No wallet in the first 25 seconds — the first third works without one.
