import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { shortAccount } from "../lib/format";
import { useWallet } from "../lib/wallet";
import { Btn } from "./ui";

/* ------------------------------------------------------------------ button */

export function ConnectButton({ onToast }: { onToast: (t: string, tone?: "ok" | "bad" | "plain") => void }) {
  const w = useWallet();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (w.phase === "connected" && w.account) {
    return (
      <div className="wallet-wrap" ref={ref}>
        <button
          className="wallet-chip"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="menu"
          aria-expanded={open}
          title={w.account}
        >
          <span className="dot live" />
          <span className="mono">{shortAccount(w.account)}</span>
          <span className="wallet-chevron" aria-hidden="true">{open ? "▴" : "▾"}</span>
        </button>

        {open && (
          <div className="wallet-menu" role="menu">
            <div className="wallet-menu-head">
              <div className="metric-label">connected account</div>
              <div className="mono" style={{ fontSize: 12.5, marginTop: 3 }}>{w.account}</div>
            </div>
            <button
              className="wallet-menu-item"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(w.account!);
                  onToast("address copied", "ok");
                } catch {
                  onToast("could not copy — select it manually", "bad");
                }
                setOpen(false);
              }}
            >
              copy address
            </button>
            <a
              className="wallet-menu-item"
              href={`https://testnet.nearblocks.io/address/${w.account}`}
              target="_blank"
              rel="noreferrer"
              onClick={() => setOpen(false)}
            >
              view on explorer ↗
            </a>
            <div className="wallet-menu-sep" />
            <div className="wallet-menu-row">
              <span className="metric-label">network</span>
              <span className="chip ok" style={{ padding: "1px 7px" }}>testnet</span>
            </div>
            <div className="wallet-menu-row">
              <span className="metric-label">accounts</span>
              <span className="mono small">{w.accounts.length}</span>
            </div>
            <div className="wallet-menu-sep" />
            <button
              className="wallet-menu-item danger"
              onClick={async () => {
                await w.disconnect();
                onToast("wallet disconnected", "plain");
                setOpen(false);
              }}
            >
              disconnect
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <>
      <Btn
        sm
        primary={w.phase === "ready"}
        onClick={w.openModal}
        disabled={w.phase === "connecting"}
        title={w.error ?? "Connect a NEAR testnet wallet"}
      >
        {w.phase === "connecting" ? "connecting…" : "connect wallet"}
      </Btn>
      <ConnectModal onToast={onToast} />
    </>
  );
}

/* ------------------------------------------------------------------- modal */

export function ConnectModal({ onToast }: { onToast: (t: string, tone?: "ok" | "bad" | "plain") => void }) {
  const w = useWallet();
  const firstRef = useRef<HTMLButtonElement | null>(null);
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!w.modalOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && w.closeModal();
    document.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => firstRef.current?.focus(), 40);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
      document.body.style.overflow = "";
    };
  }, [w.modalOpen, w]);

  if (!w.modalOpen) return null;

  const loading = w.wallets.length === 0 && !w.error;

  // Portal out of the topbar: an ancestor with backdrop-filter becomes the containing
  // block for position:fixed, which would trap the overlay inside the 60px header.
  return createPortal(
    <div className="modal-scrim" onClick={w.closeModal} role="presentation">
      <div
        className="modal wallet-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="connect-title"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="row between" style={{ alignItems: "flex-start" }}>
          <div>
            <h3 id="connect-title">Connect a wallet</h3>
            <p className="small faint mt-s">
              Testnet only. The wallet is your account — your vault keys are separate and stay in
              this browser.
            </p>
          </div>
          <button className="btn ghost sm" onClick={w.closeModal} aria-label="Close">
            ✕
          </button>
        </div>

        <div className="row mt" style={{ gap: 8 }}>
          <span className="chip ok">testnet</span>
          <span className="chip">transaction signing</span>
        </div>

        <hr className="rule" />

        {loading && (
          <div className="stack" style={{ gap: 8 }}>
            {[0, 1].map((i) => (
              <div key={i} className="skeleton" style={{ height: 58 }} />
            ))}
            <p className="small faint mt-s">asking the connector which wallets are available…</p>
          </div>
        )}

        {w.error && (
          <div className="panel" style={{ borderColor: "rgba(224,112,94,0.35)", background: "var(--bad-dim)" }}>
            <div className="panel-title" style={{ color: "var(--bad)" }}>could not load wallets</div>
            <p className="small mt-s">{w.error}</p>
            <Btn sm className="mt" onClick={w.refresh}>retry</Btn>
          </div>
        )}

        {w.wallets.length > 0 && (
          <div className="wallet-list">
            {w.wallets.map((m, i) => (
              <button
                key={m.id}
                ref={i === 0 ? firstRef : undefined}
                className="wallet-option"
                disabled={w.phase === "connecting"}
                onClick={async () => {
                  setPicked(m.id);
                  const ok = await w.connect(m.id);
                  onToast(ok ? `connected with ${m.name}` : "connection cancelled", ok ? "ok" : "plain");
                  setPicked(null);
                }}
              >
                <span className="wallet-icon">
                  {m.icon ? (
                    <img src={m.icon} alt="" width={26} height={26} referrerPolicy="no-referrer" />
                  ) : (
                    m.name.slice(0, 1)
                  )}
                </span>
                <span className="grow" style={{ textAlign: "left" }}>
                  <span className="wallet-name">{m.name}</span>
                  <span className="wallet-desc">{m.description || m.website.replace(/^https?:\/\//, "")}</span>
                </span>
                <span className="mono faint" style={{ fontSize: 10 }}>
                  {w.phase === "connecting" && picked === m.id ? "connecting…" : m.type === "injected" ? "extension" : "wallet"}
                </span>
              </button>
            ))}
          </div>
        )}

        <p className="small faint mt">
          You will approve the connection in the wallet itself. Nothing is signed by connecting.
        </p>
      </div>
    </div>,
    document.body,
  );
}
