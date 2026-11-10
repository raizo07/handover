import type { Mode } from "../lib/client";
import { Btn, Panel } from "../components/ui";

/** Clears the local simulation and reloads. Keys are kept: they are separate from state. */
export function resetDemo() {
  try {
    localStorage.removeItem("handover.demo.v1");
  } catch {
    /* storage blocked: nothing to clear */
  }
  window.location.href = window.location.pathname;
}

const STEPS: Array<{ n: string; title: string; body: string; live?: string }> = [
  {
    n: "1",
    title: "Open a business",
    body: "Treasury, 30-day revenue, operator activity and the charter are all populated. Nothing is fetched to render this.",
  },
  {
    n: "2",
    title: "Drag the per-call cap down",
    body: "Before you commit anything, the charter panel tells you which verdict the operator's next payment would get at that cap.",
  },
  {
    n: "3",
    title: "Press “replay operator”",
    body: "The spend either settles or is rejected with E20 (per-call), E21 (epoch) or E22 (allowlist). The receipt drawer shows the reverted call, and the feed records a struck-through row.",
  },
  {
    n: "4",
    title: "Press “sell this business”",
    body: "Generate an owner key, download it (the flow will not let you continue otherwise), then sign. The rotation settles in two confirmed beats and the page states what the seller now sees.",
    live: "In live mode the transfer is signed by your wallet: connect it, and the buyer field fills with your account.",
  },
  {
    n: "5",
    title: "Press “halt operator”",
    body: "The vault deletes the agent's function-call key. Replaying the operator now fails with E23 — and on chain it would fail before any contract code ran. Press resume to re-arm it.",
    live: "Live mode disables this: vault calls are signed by the business key, not by a wallet.",
  },
  {
    n: "6",
    title: "Connect a wallet",
    body: "The picker lists whatever the NEAR Connect manifest offers. After connecting, the chip shows your account, with copy, explorer and disconnect in its menu.",
  },
  {
    n: "7",
    title: "Know what the wallet signs",
    body: "Wallets sign registry actions: buying, selling, repairing a stuck rotation. They do not sign vault actions — claim, halt and charter changes belong to the business key you download at purchase, because a vault is an account with its own keys. Live mode disables those buttons and says why.",
  },
  {
    n: "8",
    title: "Reset the demo",
    body: "Restores the seeded businesses. Owner keys you downloaded are kept, because they are separate from the simulation.",
  },
];

export function JudgePage({
  mode,
  firstId,
  onOpen,
  onReset,
}: {
  mode: Mode;
  firstId?: string;
  onOpen: (id: string) => void;
  onReset: () => void;
}) {
  return (
    <>
      <header className="hero">
        <div>
          <div className="eyebrow">judge walkthrough · 8 steps · {mode === "live" ? "live testnet" : "demo data"}</div>
          <h1>Try it in two minutes</h1>
          <p>
            The default build runs on a local simulation that enforces the contract&apos;s own rule
            checks, so every rejection you see is the rejection the Rust would give. Live mode reads
            the registry deployed on testnet.
          </p>
        </div>
      </header>

      <div className="cols" style={{ gridTemplateColumns: "minmax(0, 1fr) minmax(0, 320px)" }}>
        <div className="stack">
          {STEPS.map((s) => (
            <div
              key={s.n}
              className="panel"
              style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 14, alignItems: "start" }}
            >
              <span className="eyebrow" style={{ color: "var(--accent)", fontSize: 12 }}>
                {s.n}
              </span>
              <div>
                <div style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{s.title}</div>
                <div className="small dim mt-s">{s.body}</div>
                {s.live && mode === "live" && (
                  <div className="small mt-s" style={{ color: "var(--accent)" }}>
                    {s.live}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div className="row wrap" style={{ gap: 8 }}>
            {firstId && <Btn primary onClick={() => onOpen(firstId)}>start with a business →</Btn>}
            <Btn onClick={onReset}>reset demo data</Btn>
          </div>
        </div>

        <div className="stack">
          <Panel title="two modes">
            <div className="kv">
              <div className="kv-row">
                <span className="kv-key">demo</span>
                <span className="kv-val" style={{ maxWidth: "62%", textAlign: "left" }}>
                  seeded data, rules enforced locally, no wallet, no chain
                </span>
              </div>
              <div className="kv-row">
                <span className="kv-key">live</span>
                <span className="kv-val" style={{ maxWidth: "62%", textAlign: "left" }}>
                  reads{" "}
                  <span className="mono">reg.raizo07.testnet</span>; wallet signs registry actions
                </span>
              </div>
            </div>
            <p className="small faint mt-s">
              Switch with the footer toggle, or add <span className="mono">?live=1</span> to the URL.
            </p>
          </Panel>

          <Panel title="what is real">
            <div className="kv">
              <div className="kv-row">
                <span className="kv-key">contracts</span>
                <span className="kv-val">28 Rust tests, deployed on testnet</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">demo rules</span>
                <span className="kv-val">same E-codes as the Rust</span>
              </div>
              <div className="kv-row">
                <span className="kv-key">wallet</span>
                <span className="kv-val">NEAR Connect, testnet only</span>
              </div>
            </div>
          </Panel>

          <Panel title="the one hard part">
            <p className="small dim">
              A transfer is two beats. The token moves immediately, but the vault&apos;s key rotation
              is a separate receipt, so the registry settles it with a callback and can revert if the
              vault refuses. <span className="mono">resolve_rotation</span> repairs a stuck transfer.
            </p>
          </Panel>
        </div>
      </div>
    </>
  );
}
