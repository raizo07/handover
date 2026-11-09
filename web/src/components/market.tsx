import type { Business } from "../lib/types";
import { ago, near } from "../lib/format";
import { Chip, Spark } from "./ui";

export function BizCard({ b, onOpen, now }: { b: Business; onOpen: () => void; now: number }) {
  const lastSale = b.feed.find((e) => e.kind === "sale");
  const lastAgo = lastSale ? ago(lastSale.at, now) : null;
  const pending = b.stats.pendingDividend;

  return (
    <button className="bizcard" onClick={onOpen} aria-label={`Open ${b.name}`} style={{ textAlign: "left", cursor: "pointer" }}>
      <div className="bizcard-top">
        <div>
          <div className="bizcard-name">{b.name}</div>
          <div className="bizcard-kind">
            {b.kind} · {b.tokenId}
          </div>
        </div>
        {b.stats.halted ? <Chip tone="bad">halted</Chip> : <Chip tone="ok">live</Chip>}
      </div>

      <div className="row between" style={{ alignItems: "flex-end" }}>
        <div>
          <div className="metric-label">unclaimed</div>
          <div className="metric-value" style={{ fontSize: 20 }}>
            {near(pending)} <span className="faint" style={{ fontSize: 11 }}>NEAR</span>
          </div>
        </div>
        <Spark data={b.history.slice(-14)} />
      </div>

      <div className="bizcard-metrics">
        <div>
          <div className="metric-label">treasury</div>
          <div className="metric-value">{near(b.stats.treasuryEstimate)}</div>
        </div>
        <div>
          <div className="metric-label">lifetime revenue</div>
          <div className="metric-value">{near(b.stats.revenueTotal)}</div>
        </div>
      </div>

      <div className="bizcard-foot">
        <span className="mono faint" style={{ fontSize: 10.5 }}>
          {b.operator}
        </span>
        <span className="mono" style={{ fontSize: 10.5, color: b.stats.halted ? "var(--bad)" : "var(--ok)" }}>
          {b.stats.halted ? "key deleted" : lastAgo === null ? "waiting" : `sold ${lastAgo} ago`}
        </span>
      </div>
    </button>
  );
}
