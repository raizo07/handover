import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Receipt } from "./lib/types";
import { getLiveFallback, useBusiness, useBusinesses, useClient, useNow, useRoute, useToasts } from "./lib/hooks";
import { Marketplace } from "./pages/Marketplace";
import { BusinessPage } from "./pages/Business";
import { BuyPage } from "./pages/Buy";
import { KeysPage } from "./pages/Keys";
import { JudgePage, resetDemo } from "./pages/Judge";
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
    document.title = business ? `${business.name} · FREEHOLD` : "FREEHOLD";
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
    page = (
      <JudgePage
        mode={mode}
        firstId={businesses[0]?.tokenId}
        onOpen={openBusiness}
        onReset={resetDemo}
      />
    );
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
              FREE<b>HOLD</b>
            </span>
            <span className="brand-sub">business as an account</span>
          </a>
          <span className="topbar-spacer" />
          <span className="desktop-only row" style={{ gap: 10 }}>
            <button className="btn ghost sm" onClick={() => navigate("/judge")}>walkthrough</button>
            <button className="btn ghost sm" onClick={() => navigate("/keys")}>keys</button>
          </span>
          <MobileMenu navigate={navigate} mode={mode} />
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
            {getLiveFallback()
              ? `live registry unavailable (${getLiveFallback()}) — showing demo data`
              : "demo data — generated from a fixed seed, no chain calls. the same rule checks the contract runs are enforced locally (E20 / E21 / E22 / E23)."}
          </div>
        </div>
      )}

      <main className="main">
        <div className="wrap">{page}</div>
      </main>

      <footer className="footer wrap">
        <span>FREEHOLD · NEAR HACKATHON · testnet only</span>
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
            {receipt.txHash && (
              <a
                className="btn sm mt"
                href={`https://testnet.nearblocks.io/txns/${receipt.txHash}`}
                target="_blank"
                rel="noreferrer"
              >
                view transaction on explorer ↗
              </a>
            )}
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

/** On narrow screens the two nav links collapse into one menu button. */
function MobileMenu({
  navigate,
  mode,
}: {
  navigate: (to: string) => void;
  mode: "demo" | "live";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="wallet-wrap mobile-only" ref={ref}>
      <button className="btn ghost sm" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        menu
      </button>
      {open && (
        <div className="wallet-menu sheet" role="menu">
          <button className="wallet-menu-item" onClick={() => { navigate("/judge"); setOpen(false); }}>
            walkthrough
          </button>
          <button className="wallet-menu-item" onClick={() => { navigate("/keys"); setOpen(false); }}>
            keys
          </button>
          <button
            className="wallet-menu-item"
            onClick={() => {
              const url = new URL(window.location.href);
              if (mode === "demo") url.searchParams.set("live", "1");
              else url.searchParams.delete("live");
              window.location.href = url.toString();
            }}
          >
            {mode === "demo" ? "read live testnet" : "back to demo data"}
          </button>
        </div>
      )}
    </div>
  );
}
