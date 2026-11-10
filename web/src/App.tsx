import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Receipt } from "./lib/types";
import { useBusiness, useBusinesses, useClient, useNow, useRoute, useToasts } from "./lib/hooks";
import { Marketplace } from "./pages/Marketplace";
import { BusinessPage } from "./pages/Business";
import { BuyPage } from "./pages/Buy";
import { KeysPage } from "./pages/Keys";
import { Btn, Drawer, Panel, ReceiptView, Toasts } from "./components/ui";
import { ConnectButton } from "./components/wallet";

export default function App() {
  const client = useClient();
  const businesses = useBusinesses(client);
  const now = useNow(1000);
  const { path, navigate } = useRoute();
  const { toasts, push } = useToasts();
  const [receipt, setReceipt] = useState<Receipt | null>(null);

  const seg = useMemo(() => path.split("/").filter(Boolean), [path]);
  const tokenId = seg[0] === "b" ? seg[1] : undefined;
  const business = useBusiness(client, tokenId);

  const openBusiness = useCallback((id: string) => navigate(`/b/${id}`), [navigate]);

  useEffect(() => {
    document.title = business ? `${business.name} · HANDOVER` : "HANDOVER";
  }, [business]);

  const mode = client?.mode ?? "demo";

  let page: ReactNode;
  if (!client) {
    page = <div className="panel skeleton" style={{ height: 220 }} />;
  } else if (seg.length === 0) {
    page = <Marketplace businesses={businesses} now={now} onOpen={openBusiness} mode={mode} />;
  } else if (seg[0] === "keys") {
    page = <KeysPage toast={push} />;
  } else if (seg[0] === "judge") {
    page = <JudgePage onOpen={openBusiness} firstId={businesses[0]?.tokenId} />;
  } else if (seg[0] === "b" && business && seg[2] === "buy") {
    page = <BuyPage b={business} client={client} navigate={navigate} toast={push} />;
  } else if (seg[0] === "b" && business) {
    page = (
      <BusinessPage b={business} client={client} now={now} navigate={navigate} onReceipt={setReceipt} toast={push} />
    );
  } else {
    page = (
      <Panel title="not found">
        <h2>That business is not in the registry.</h2>
        <Btn className="mt" onClick={() => navigate("/")}>← marketplace</Btn>
      </Panel>
    );
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="wrap topbar-inner">
          <a href="/" className="brand" onClick={(e) => { e.preventDefault(); navigate("/"); }}>
            <span className="brand-mark">
              HAND<b>OVER</b>
            </span>
            <span className="brand-sub">business as an account</span>
          </a>
          <span className="topbar-spacer" />
          <button className="btn ghost sm" onClick={() => navigate("/judge")}>walkthrough</button>
          <button className="btn ghost sm" onClick={() => navigate("/keys")}>keys</button>
          <ConnectButton onToast={push} />
          <span className="netbadge">
            <span className={`dot ${mode === "live" ? "live" : ""}`} />
            {mode === "live" ? "testnet · live" : "demo"}
          </span>
        </div>
      </header>

      {mode === "demo" && (
        <div className="demo-banner">
          <div className="wrap">
            demo data — generated from a fixed seed, no chain calls. the same rule checks the
            contract runs are enforced locally (E20 / E21 / E22 / E23).
          </div>
        </div>
      )}

      <main className="main">
        <div className="wrap">{page}</div>
      </main>

      <footer className="footer wrap">
        <span>HANDOVER · NEAR HACKATHON · testnet only</span>
        <span className="row" style={{ gap: 14 }}>
          <span>
            {businesses.length} businesses ·{" "}
            {mode === "demo" ? "simulated vault" : "registry reads via near-kit"}
          </span>
          <button
            className="btn ghost sm"
            onClick={() => {
              const url = new URL(window.location.href);
              if (mode === "demo") url.searchParams.set("live", "1");
              else url.searchParams.delete("live");
              window.location.href = url.toString();
            }}
          >
            {mode === "demo" ? "read live testnet →" : "back to demo data"}
          </button>
        </span>
      </footer>

      <Drawer
        open={receipt !== null}
        onClose={() => setReceipt(null)}
        title={receipt?.ok ? "Transaction settled" : "Transaction rejected"}
        subtitle={receipt ? `${new Date(receipt.at).toLocaleTimeString()} · ${receipt.ok ? "success" : receipt.code ?? "error"}` : ""}
      >
        {receipt && (
          <>
            <div className="row between" style={{ marginBottom: 12 }}>
              <span className="mono small">{receipt.message}</span>
              <span className={`chip ${receipt.ok ? "ok" : "bad"}`}>{receipt.ok ? "ok" : receipt.code ?? "error"}</span>
            </div>
            <ReceiptView lines={receipt.logs.length ? receipt.logs : [receipt.message]} />
            <div className="kv mt">
              <div className="kv-row">
                <span className="kv-key">what to look at</span>
                <span className="kv-val" style={{ maxWidth: "62%" }}>
                  {receipt.ok
                    ? "the EVENT_JSON emitted by the contract, then the success value"
                    : "the error code — it is the same code the Rust test asserts"}
                </span>
              </div>
            </div>
            <p className="small faint mt-s">
              In live mode this drawer shows the raw RPC outcome for the same call.
            </p>
          </>
        )}
      </Drawer>

      <Toasts items={toasts} />
    </div>
  );
}

function JudgePage({ onOpen, firstId }: { onOpen: (id: string) => void; firstId?: string }) {
  const steps = [
    ["1", "Open a business", "Treasury, 30-day revenue, operator activity, charter — all populated."],
    ["2", "Drag the per-call cap down", "The charter panel tells you, before you sign, which verdict the operator's next payment gets."],
    ["3", "Press “replay operator”", "Either the spend settles, or it is rejected with E20/E21/E22 and the receipt drawer shows the reverted call."],
    ["4", "Press “sell this business”", "Generate and download an owner key, sign, and watch the rotation settle in two confirmed beats."],
    ["5", "Press “halt operator”", "The vault deletes the agent's function-call key. Its next transaction cannot be signed at all."],
    ["6", "Reset the demo", "Everything is local; clearing site data restores the seeded state."],
  ];
  return (
    <>
      <header className="hero">
        <div>
          <div className="eyebrow">judge walkthrough · 6 steps</div>
          <h1>Try it in two minutes</h1>
          <p>
            No wallet, no faucet, no chain. Everything below runs against a local simulation that
            enforces the contract&apos;s rules. When <span className="mono">VITE_REGISTRY_CONTRACT</span> is
            set, the same components read the deployed contract instead.
          </p>
        </div>
      </header>

      <div className="stack">
        {steps.map(([n, title, body]) => (
          <div key={n} className="panel" style={{ display: "grid", gridTemplateColumns: "34px 1fr", gap: 14, alignItems: "start" }}>
            <span className="eyebrow" style={{ color: "var(--accent)", fontSize: 12 }}>{n}</span>
            <div>
              <div style={{ fontFamily: "var(--serif)", fontSize: 18 }}>{title}</div>
              <div className="small dim mt-s">{body}</div>
            </div>
          </div>
        ))}
      </div>

      {firstId && (
        <Btn primary className="mt-l" onClick={() => onOpen(firstId)}>
          start with a business →
        </Btn>
      )}
      <p className="small faint mt">
        The README documents the contract invariants and how to run the Rust test suite
        (<span className="mono">make test</span>).
      </p>
    </>
  );
}
