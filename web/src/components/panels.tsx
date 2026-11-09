import { useEffect, useState } from "react";
import type { Business, Receipt, Rules } from "../lib/types";
import { plannedSpend } from "../lib/fixtures";
import { countdown, near, shortKey } from "../lib/format";
import { Btn, Chip, KV, Meter, Panel } from "./ui";

/* --------------------------------------------------------------- operator */

export function OperatorPanel({
  b,
  now,
  busy,
  onReplay,
  onHalt,
  onResume,
  onSpend,
}: {
  b: Business;
  now: number;
  busy: string | null;
  onReplay: () => void;
  onHalt: () => void;
  onResume: () => void;
  onSpend: (to: string, amount: bigint) => void;
}) {
  const plan = plannedSpend(b);
  const used = b.stats.spentEpoch;
  const cap = b.rules.maxSpendPerEpoch;
  const over = used + plan.amount > cap;

  return (
    <Panel
      title="Operator"
      right={
        b.stats.halted ? <Chip tone="bad">key deleted</Chip> : <Chip tone="ok">scoped key live</Chip>
      }
    >
      <div style={{ marginBottom: 10 }}>
        <div className="mono" style={{ fontSize: 12.5 }}>{b.operator}</div>
        <div className="faint mono" style={{ fontSize: 10.5, marginTop: 3 }}>
          function-call key → record_sale, operator_spend
        </div>
      </div>

      <div className="mt-s">
        <div className="row between" style={{ marginBottom: 6 }}>
          <span className="metric-label">epoch spend</span>
          <span className="mono small">
            {near(used)} / {near(cap)} NEAR
          </span>
        </div>
        <Meter value={used} max={cap} />
        <div className="row between mt-s">
          <span className="faint small mono">window {Math.round(b.rules.epochSecs / 3600)}h</span>
          <span className="faint small mono">
            resets in {countdown(Math.max(0, b.stats.epochStart + b.rules.epochSecs * 1000 - now))}
          </span>
        </div>
      </div>

      <hr className="rule" />

      <div className="row wrap" style={{ gap: 8 }}>
        <Btn primary sm onClick={onReplay} disabled={busy !== null}>
          {busy === "replay" ? "settling…" : "replay operator"}
        </Btn>
        <Btn
          sm
          onClick={() => onSpend(plan.to, plan.amount + plan.amount / 4n)}
          disabled={busy !== null}
          title="Force a spend that breaks the per-call cap"
        >
          try an overspend
        </Btn>
        {!b.stats.halted ? (
          <Btn sm variant="danger" onClick={onHalt} disabled={busy !== null}>
            halt operator
          </Btn>
        ) : (
          <Btn sm onClick={onResume} disabled={busy !== null}>
            resume
          </Btn>
        )}
      </div>

      <p className="small faint mt-s">
        Next attempt pays <span className="mono">{near(plan.amount)} NEAR</span> to{" "}
        <span className="mono">{plan.to}</span> —{" "}
        {b.stats.halted ? (
          <span style={{ color: "var(--bad)" }}>would be rejected: key no longer exists</span>
        ) : over ? (
          <span style={{ color: "var(--bad)" }}>would be rejected: E21 epoch cap</span>
        ) : plan.amount > b.rules.maxSingleSpend ? (
          <span style={{ color: "var(--bad)" }}>would be rejected: E20 per-call cap</span>
        ) : (
          <span style={{ color: "var(--ok)" }}>would settle</span>
        )}
      </p>
    </Panel>
  );
}

/* ------------------------------------------------------------------ feed */

export function FeedPanel({ b, now }: { b: Business; now: number }) {
  return (
    <Panel
      title="Activity"
      right={<span className="faint small mono">{b.feed.length} events</span>}
    >
      <div className="feed" role="log" aria-live="polite">
        {b.feed.slice(0, 14).map((e) => {
          const secs = Math.round((now - e.at) / 1000);
          return (
            <div className={`feed-row ${e.kind === "blocked" ? "blocked" : ""}`} key={e.id}>
              <span className="feed-time">{secs < 60 ? `${secs}s` : `${Math.round(secs / 60)}m`}</span>
              <span className="feed-desc">
                {e.desc}
                {e.code && <span className="mono" style={{ marginLeft: 8, fontSize: 10.5 }}>{e.code}</span>}
              </span>
              {e.amount !== undefined ? (
                <span
                  className={`feed-amount ${
                    e.kind === "sale" ? "in" : e.kind === "blocked" ? "blocked" : "out"
                  }`}
                >
                  {e.kind === "sale" ? "+" : e.kind === "blocked" ? "" : "−"}
                  {near(e.amount)}
                </span>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

/* ---------------------------------------------------------------- charter */

export function CharterPanel({
  b,
  now,
  busy,
  onPropose,
  onApply,
  onCancel,
}: {
  b: Business;
  now: number;
  busy: string | null;
  onPropose: (rules: Rules) => void;
  onApply: () => void;
  onCancel: () => void;
}) {
  const ceiling = Math.max(Number(b.rules.maxSpendPerEpoch), 1) / 1e24;
  const [cap, setCap] = useState(() => Number(b.rules.maxSingleSpend) / 1e24);
  const [dirty, setDirty] = useState(false);

  // follow the chain when the charter changes underneath us
  useEffect(() => {
    setCap(Number(b.rules.maxSingleSpend) / 1e24);
    setDirty(false);
  }, [b.rules.maxSingleSpend]);

  const nextRules: Rules = {
    ...b.rules,
    maxSingleSpend: BigInt(Math.round(cap * 1e6)) * 10n ** 18n,
    maxSpendPerEpoch: BigInt(Math.round(Math.max(cap, ceiling * 0.6) * 1e6)) * 10n ** 18n,
  };

  const pending = b.pendingRules;
  const left = pending ? pending.at + b.rules.rulesDelaySecs * 1000 - now : 0;
  const plan = plannedSpend(b);
  const wouldBlock = plan.amount > nextRules.maxSingleSpend;

  return (
    <Panel title="Charter" right={<span className="faint small mono">rules_delay {b.rules.rulesDelaySecs}s</span>}>
      <div className="row between" style={{ marginBottom: 4 }}>
        <span className="metric-label">per-call cap</span>
        <span className="mono" style={{ fontSize: 15 }}>{cap.toFixed(2)} NEAR</span>
      </div>

      <input
        className="slider"
        type="range"
        min={0}
        max={Math.max(ceiling, 0.05)}
        step={0.01}
        value={cap}
        aria-label="Per-call spend cap"
        style={{ ["--fill" as string]: `${(cap / Math.max(ceiling, 0.05)) * 100}%` }}
        onChange={(e) => {
          setCap(Number(e.target.value));
          setDirty(true);
        }}
      />

      <div className="row between">
        <span className="faint small mono">0</span>
        <span className="faint small mono">{ceiling.toFixed(2)} max</span>
      </div>

      <p className="small mt-s" style={{ color: dirty ? "var(--accent)" : "var(--ink-faint)" }}>
        At {cap.toFixed(2)} NEAR, the operator&apos;s next {near(plan.amount)} NEAR payment{" "}
        {wouldBlock ? <b style={{ color: "var(--bad)" }}>is rejected (E20)</b> : <b style={{ color: "var(--ok)" }}>still settles</b>}.
      </p>

      <div className="row wrap mt-s" style={{ gap: 8 }}>
        <Btn sm primary onClick={() => onPropose(nextRules)} disabled={!dirty || busy !== null}>
          propose change
        </Btn>
        {pending && (
          <>
            <Btn sm onClick={onApply} disabled={left > 0 || busy !== null}>
              apply {left > 0 ? `(${countdown(Math.max(0, left))})` : ""}
            </Btn>
            <Btn sm variant="ghost" onClick={onCancel} disabled={busy !== null}>
              cancel
            </Btn>
          </>
        )}
        <Btn sm variant="ghost" onClick={() => { setCap(Number(b.rules.maxSingleSpend) / 1e24); setDirty(false); }}>
          reset
        </Btn>
      </div>

      <hr className="rule" />

      <KV
        pairs={[
          ["epoch cap", `${near(b.rules.maxSpendPerEpoch)} NEAR / ${Math.round(b.rules.epochSecs / 3600)}h`],
          ["allowlist", b.rules.allowRecipients.length ? b.rules.allowRecipients.join(", ") : "any recipient"],
          ["claim cooldown", b.rules.claimCooldownSecs ? `${b.rules.claimCooldownSecs}s` : "none"],
          ["owner key", shortKey(`ed25519:${b.tokenId}…`)],
        ]}
      />
    </Panel>
  );
}

/* --------------------------------------------------------------- rotation */

export function RotationPanel({
  b,
  busy,
  onResolve,
  onStartTransfer,
}: {
  b: Business;
  busy: string | null;
  onResolve: () => void;
  onStartTransfer: () => void;
}) {
  const state = b.rotation;
  const steps = [
    {
      key: "pending",
      title: "rotation_pending",
      desc: "token reassigned; vault asked to rotate its owner key",
      state: state === "pending" ? "active" : "done",
    },
    {
      key: "applied",
      title: "rotation_applied",
      desc: "buyer's key is live, seller's key deleted",
      state: state === "applied" ? "done" : "idle",
    },
    ...(state === "failed"
      ? [
          {
            key: "failed",
            title: "rotation_failed",
            desc: "reverted to the seller; resolve_rotation can retry",
            state: "failed",
          },
        ]
      : []),
  ] as Array<{ key: string; title: string; desc: string; state: "done" | "active" | "failed" | "idle" }>;

  return (
    <Panel
      title="Ownership"
      right={
        state === "applied" ? (
          <Chip tone="ok">settled</Chip>
        ) : state === "pending" ? (
          <Chip tone="warn">settling…</Chip>
        ) : state === "failed" ? (
          <Chip tone="bad">failed</Chip>
        ) : (
          <Chip>idle</Chip>
        )
      }
    >
      <div className="timeline">
        {steps.map((s, i) => (
          <div className={`tl-step ${s.state === "done" ? "done" : s.state === "active" ? "active" : s.state === "failed" ? "failed" : ""}`} key={s.key}>
            <span className="tl-dot">{s.state === "done" ? "✓" : s.state === "active" ? "•" : s.state === "failed" ? "!" : i + 1}</span>
            <div>
              <div className="tl-title mono">{s.title}</div>
              <div className="tl-desc">{s.desc}</div>
            </div>
          </div>
        ))}
      </div>

      <hr className="rule" />
      <KV
        pairs={[
          ["holder", b.holder],
          ["epoch", String(b.epoch)],
          ["vault", b.vault],
        ]}
      />

      <div className="row mt-s" style={{ gap: 8 }}>
        <Btn sm primary onClick={onStartTransfer} disabled={state === "pending" || busy !== null}>
          sell this business
        </Btn>
        {state === "failed" && (
          <Btn sm onClick={onResolve} disabled={busy !== null}>
            resolve_rotation
          </Btn>
        )}
      </div>
      <p className="small faint mt-s">
        A transfer is two beats on purpose: the vault commits its key change in a separate
        receipt, so the registry settles it with a callback and can revert if the vault
        refuses.
      </p>
    </Panel>
  );
}

export function ReceiptLine({ r }: { r: Receipt }) {
  return (
    <div className={`chip ${r.ok ? "ok" : "bad"}`} style={{ marginRight: 6 }}>
      {r.ok ? "ok" : r.code ?? "failed"} · {r.message}
    </div>
  );
}
