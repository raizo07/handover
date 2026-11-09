import { useState } from "react";
import type { OwnerKey } from "../lib/types";
import { addKey, downloadKey, importOwnerKey, loadKeys, removeKey } from "../lib/keys";
import { shortKey } from "../lib/format";
import { Btn, Chip, KV, Panel } from "../components/ui";

export function KeysPage({ toast }: { toast: (t: string, tone?: "ok" | "bad" | "plain") => void }) {
  const [keys, setKeys] = useState<OwnerKey[]>(() => loadKeys());
  const [secret, setSecret] = useState("");

  return (
    <>
      <header className="hero">
        <div>
          <div className="eyebrow">keys</div>
          <h1>Owner keys</h1>
          <p>
            Keys live in this browser&apos;s storage. That is a convenience for a testnet demo, not
            custody: if this profile is wiped, the key is gone unless you downloaded it.
          </p>
        </div>
      </header>

      <div className="cols">
        <div className="stack">
          <Panel title={`stored keys · ${keys.length}`}>
            {keys.length === 0 ? (
              <p className="small dim">
                No keys yet. Buy a business, or import a key file you downloaded earlier.
              </p>
            ) : (
              <div className="stack" style={{ gap: 12 }}>
                {keys.map((k) => (
                  <div key={k.id} className="panel" style={{ padding: 14, background: "rgba(255,255,255,0.015)" }}>
                    <div className="row between wrap" style={{ gap: 8 }}>
                      <div>
                        <div style={{ fontFamily: "var(--serif)", fontSize: 16 }}>{k.label}</div>
                        <div className="mono small faint">{shortKey(k.publicKey)}</div>
                      </div>
                      <div className="row" style={{ gap: 6 }}>
                        <Btn sm onClick={() => { downloadKey(k); toast("key downloaded", "ok"); }}>download</Btn>
                        <Btn
                          sm
                          variant="danger"
                          onClick={() => {
                            removeKey(k.id);
                            setKeys(loadKeys());
                            toast("key deleted from this browser", "bad");
                          }}
                        >
                          forget
                        </Btn>
                      </div>
                    </div>
                    <div className="faint mono" style={{ fontSize: 10, marginTop: 6 }}>
                      created {new Date(k.createdAt).toISOString().slice(0, 16).replace("T", " ")}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Panel>
        </div>

        <div className="stack">
          <Panel title="import">
            <div className="field">
              <label className="metric-label" htmlFor="secret">secret key (ed25519:…)</label>
              <input
                id="secret"
                className="input"
                value={secret}
                onChange={(e) => setSecret(e.target.value)}
                placeholder="ed25519:…"
                spellCheck={false}
                autoComplete="off"
              />
            </div>
            <Btn
              className="mt"
              block
              disabled={!secret.trim().startsWith("ed25519:")}
              onClick={() => {
                try {
                  const k = importOwnerKey(secret.trim(), "imported");
                  addKey(k);
                  setKeys(loadKeys());
                  setSecret("");
                  toast("key imported", "ok");
                } catch {
                  toast("that is not a valid ed25519 secret key", "bad");
                }
              }}
            >
              import
            </Btn>
          </Panel>

          <Panel title="storage">
            <KV
              pairs={[
                ["where", "this browser (localStorage)"],
                ["encrypted", "no — demo build"],
                ["network", "testnet only"],
              ]}
            />
            <p className="small faint mt-s">
              <Chip tone="warn">testnet</Chip> Never put a mainnet key in a browser demo.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
