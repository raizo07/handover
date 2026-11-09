import type { Business } from "../lib/types";
import { BizCard } from "../components/market";
import { near } from "../lib/format";

export function Marketplace({
  businesses,
  now,
  onOpen,
  mode,
}: {
  businesses: Business[];
  now: number;
  onOpen: (tokenId: string) => void;
  mode: "demo" | "live";
}) {
  const totalRevenue = businesses.reduce((s, b) => s + b.stats.revenueTotal, 0n);
  const totalUnclaimed = businesses.reduce((s, b) => s + b.stats.pendingDividend, 0n);

  return (
    <>
      <header className="hero">
        <div>
          <div className="eyebrow">marketplace · {businesses.length} businesses</div>
          <h1 style={{ marginTop: 10 }}>
            Buy a going concern,
            <br />
            not a keyring.
          </h1>
          <p>
            Every business below is a NEAR account with its own treasury and an operator on a
            scoped key. The token is the share. Buy it and the vault rotates its owner key —
            while the machine keeps selling.
          </p>
        </div>
        <div className="panel" style={{ minWidth: 240 }}>
          <div className="metric-label">unclaimed across all</div>
          <div className="big-number" style={{ marginTop: 6 }}>
            {near(totalUnclaimed)}
            <span className="faint" style={{ fontSize: "0.42em", marginLeft: 6 }}>NEAR</span>
          </div>
          <div className="metric-label mt-s">lifetime revenue</div>
          <div className="mono" style={{ fontSize: 15, marginTop: 2 }}>
            {near(totalRevenue)} NEAR
          </div>
          <div className="hr-note mt-s">
            {mode === "demo"
              ? "Demo data: generated from a fixed seed, not from a chain."
              : "Live: read from the deployed registry on testnet."}
          </div>
        </div>
      </header>

      <div className="cards">
        {businesses.map((b) => (
          <BizCard key={b.tokenId} b={b} now={now} onOpen={() => onOpen(b.tokenId)} />
        ))}
      </div>

      <section className="mt-l" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 }}>
        {[
          ["01", "The business is an account", "A sub-account holds the treasury, the owner key and a function-call key for the operator."],
          ["02", "The charter binds the operator", "Per-call cap, epoch cap, allowlist, halt switch. Enforced where the money is."],
          ["03", "The token is the share", "Transfer it and the vault rotates the owner key. The operator never stops."],
        ].map(([n, t, d]) => (
          <div key={n}>
            <div className="eyebrow" style={{ color: "var(--accent)" }}>{n}</div>
            <div style={{ fontFamily: "var(--serif)", fontSize: 17, marginTop: 6 }}>{t}</div>
            <div className="small faint mt-s">{d}</div>
          </div>
        ))}
      </section>
    </>
  );
}
