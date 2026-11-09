import { useMemo, useState } from "react";
import type { Business, OwnerKey } from "../lib/types";
import type { DataClient } from "../lib/client";
import { downloadKey, generateOwnerKey } from "../lib/keys";
import { shortKey } from "../lib/format";
import { Btn, Chip, KV, Panel, ReceiptView } from "../components/ui";

type Step = 1 | 2 | 3 | 4;

export function BuyPage({
  b,
  client,
  navigate,
  toast,
}: {
  b: Business;
  client: DataClient;
  navigate: (to: string) => void;
  toast: (t: string, tone?: "ok" | "bad" | "plain") => void;
}) {
  const [step, setStep] = useState<Step>(1);
  const [account, setAccount] = useState("collector.testnet");
  const [key, setKey] = useState<OwnerKey | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [logs, setLogs] = useState<string[]>([]);

  const nextEpoch = b.epoch + 1;
  const settled = b.rotation === "applied" && b.holder === account;

  const steps = useMemo(
    () => [
      { n: 1, label: "owner key" },
      { n: 2, label: "review" },
      { n: 3, label: "sign" },
      { n: 4, label: "settle" },
    ],
    [],
  );

  const sign = async () => {
    if (!key) return;
    setBusy(true);
    setError(null);
    const r = await client.transfer(b.tokenId, account.trim(), key.publicKey);
    setLogs(r.logs);
    if (!r.ok) {
      setError(`${r.code ?? "rejected"} · ${r.message}`);
      toast(`${r.code ?? "rejected"} · ${r.message}`, "bad");
    } else {
      setStep(4);
      toast("rotation pending — watch it settle", "ok");
    }
    setBusy(false);
  };

  if (b.rotation === "pending") {
    return (
      <Panel title="Transfer in flight">
        <h2>Settling…</h2>
        <p className="dim mt-s">
          The token already points at {b.holder}, but the vault&apos;s key rotation is a separate
          receipt. The registry settles it with a callback; if the vault refuses, the token reverts
          to the seller and <span className="mono">resolve_rotation</span> can retry.
        </p>
        <div className="row mt-l" style={{ gap: 10 }}>
          <Chip tone="warn">rotation_pending</Chip>
          <span className="faint small mono">epoch {b.epoch}</span>
        </div>
        <Btn className="mt" onClick={() => navigate(`/b/${b.tokenId}`)}>back to the business</Btn>
      </Panel>
    );
  }

  return (
    <>
      <div className="row" style={{ marginBottom: 18 }}>
        <Btn sm variant="ghost" onClick={() => navigate(`/b/${b.tokenId}`)}>← {b.name}</Btn>
      </div>

      <header className="biz-head">
        <div>
          <div className="eyebrow">acquire · {b.tokenId}</div>
          <h1 style={{ marginBottom: 6 }}>Buy {b.name}</h1>
          <p className="dim" style={{ maxWidth: "56ch" }}>
            You receive the token, the vault rotates its owner key to yours, and the operator keeps
            trading. The treasury and the unclaimed dividend stay with the business — they become
            yours the moment the rotation applies.
          </p>
        </div>
      </header>

      <div className="cols">
        <div className="stack">
          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
            {steps.map((s) => (
              <Chip key={s.n} tone={step === s.n ? "warn" : step > s.n ? "ok" : "plain"}>
                {step > s.n ? "✓ " : ""}
                {s.n}. {s.label}
              </Chip>
            ))}
          </div>

          {step === 1 && (
            <Panel title="1 · your owner key">
              <p className="small dim">
                A vault grants full access to a <b>public key</b>, not to an account name. So this
                browser mints an ed25519 keypair for you. It is a bearer instrument: whoever holds
                the secret key can claim the dividends.
              </p>
              <div className="field mt">
                <label className="metric-label" htmlFor="acct">your NEAR account (testnet)</label>
                <input
                  id="acct"
                  className="input"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                  placeholder="you.testnet"
                  autoComplete="off"
                  spellCheck={false}
                />
              </div>

              <div className="row wrap mt" style={{ gap: 8 }}>
                <Btn
                  primary
                  onClick={() => {
                    const k = generateOwnerKey(account.trim() || "owner");
                    setKey(k);
                    setDownloaded(false);
                  }}
                >
                  {key ? "regenerate key" : "generate key"}
                </Btn>
                {key && (
                  <>
                    <Btn onClick={() => { downloadKey(key); setDownloaded(true); }}>
                      download key file
                    </Btn>
                    <Btn
                      variant="ghost"
                      onClick={() => { setStep(2); }}
                      disabled={!downloaded}
                      title={downloaded ? undefined : "Download the key first"}
                    >
                      continue →
                    </Btn>
                  </>
                )}
              </div>

              {key && (
                <div className="mt">
                  <KV pairs={[["public key", shortKey(key.publicKey)], ["label", key.label]]} />
                  <p className="small mt-s" style={{ color: downloaded ? "var(--ok)" : "var(--accent)" }}>
                    {downloaded
                      ? "Key file saved. Continue when ready."
                      : "Download the key file to continue — without it you cannot claim this business later."}
                  </p>
                </div>
              )}
            </Panel>
          )}

          {step === 2 && key && (
            <Panel title="2 · review">
              <KV
                pairs={[
                  ["from (seller)", b.holder],
                  ["to (you)", account],
                  ["epoch", settled ? `${b.epoch}` : `${b.epoch} → ${nextEpoch}`],
                  ["your key", shortKey(key.publicKey)],
                  ["vault action", "DeleteKey(seller) + AddKey(yours, full access)"],
                  ["operator", "untouched — keeps trading"],
                ]}
              />
              <div className="row mt" style={{ gap: 8 }}>
                <Btn variant="ghost" onClick={() => setStep(1)}>← back</Btn>
                <Btn primary onClick={() => setStep(3)}>continue →</Btn>
              </div>
            </Panel>
          )}

          {step === 3 && key && (
            <Panel title="3 · sign">
              <p className="small dim">
                This calls <span className="mono">nft_transfer(receiver, token_id, memo=key)</span> on
                the registry with 1 yoctoNEAR attached. The memo carries your public key — that is how
                the vault knows what to grant.
              </p>
              <div className="row mt" style={{ gap: 8 }}>
                <Btn variant="ghost" onClick={() => setStep(2)} disabled={busy}>← back</Btn>
                <Btn primary onClick={sign} disabled={busy || !account.trim()}>
                  {busy ? "signing…" : "sign transfer"}
                </Btn>
              </div>
              {error && (
                <p className="small mt-s" style={{ color: "var(--bad)" }}>
                  {error}
                </p>
              )}
              {logs.length > 0 && (
                <div className="mt">
                  <ReceiptView lines={logs} />
                </div>
              )}
            </Panel>
          )}

          {step === 4 && (
            <Panel title="4 · settled">
              <h2>
                {settled ? "You own it." : "Settling…"}
              </h2>
              <p className="dim mt-s small">
                {settled
                  ? "The rotation applied: your key is live on the vault and the seller's key is gone. The operator never stopped."
                  : "Waiting for the vault's receipt."}
              </p>

              {settled && (
                <>
                  <hr className="rule" />
                  <div className="timeline">
                    <div className="tl-step done">
                      <span className="tl-dot">✓</span>
                      <div>
                        <div className="tl-title mono">rotation_pending</div>
                        <div className="tl-desc">token reassigned to {account}</div>
                      </div>
                    </div>
                    <div className="tl-step done">
                      <span className="tl-dot">✓</span>
                      <div>
                        <div className="tl-title mono">ownership_rotated</div>
                        <div className="tl-desc">
                          vault deleted the seller&apos;s key and added {shortKey(key?.publicKey)}
                        </div>
                      </div>
                    </div>
                    <div className="tl-step done">
                      <span className="tl-dot">✓</span>
                      <div>
                        <div className="tl-title mono">rotation_applied</div>
                        <div className="tl-desc">registry callback confirmed the vault receipt</div>
                      </div>
                    </div>
                  </div>

                  <hr className="rule" />
                  <div className="panel" style={{ background: "rgba(224,112,94,0.06)", borderColor: "rgba(224,112,94,0.3)" }}>
                    <div className="panel-title" style={{ color: "var(--bad)" }}>what the seller sees now</div>
                    <p className="small mt-s">
                      Their key was deleted on-chain. Any transaction they sign for this vault now
                      fails inside nearcore with{" "}
                      <span className="mono" style={{ color: "var(--bad)" }}>Access key does not exist</span>{" "}
                      — before a single line of contract code runs. That is the difference between a
                      rule and a lock.
                    </p>
                  </div>

                  <div className="row mt" style={{ gap: 8 }}>
                    <Btn primary onClick={() => navigate(`/b/${b.tokenId}`)}>open your business →</Btn>
                    <Btn variant="ghost" onClick={() => navigate("/keys")}>your keys</Btn>
                  </div>
                </>
              )}
            </Panel>
          )}
        </div>

        <div className="stack">
          <Panel title="What you are buying">
            <KV
              pairs={[
                ["business", b.name],
                ["unclaimed dividend", `${(Number(b.stats.pendingDividend / 10n ** 22n) / 100).toFixed(2)} NEAR`],
                ["treasury", `${(Number(b.stats.treasuryEstimate / 10n ** 22n) / 100).toFixed(2)} NEAR`],
                ["operator", b.operator],
                ["epoch", settled ? `${b.epoch}` : `${b.epoch} → ${nextEpoch}`],
              ]}
            />
            <p className="small faint mt-s">
              Dividends are metadata-free: the vault pays whoever holds the token at claim time.
              Buying mid-life means inheriting the unclaimed amount — that is the point.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
