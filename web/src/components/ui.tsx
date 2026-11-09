import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { near } from "../lib/format";

/* ------------------------------------------------------------------ atoms */

export function Chip({
  tone = "plain",
  children,
}: {
  tone?: "plain" | "ok" | "bad" | "warn";
  children: ReactNode;
}) {
  return <span className={`chip ${tone === "plain" ? "" : tone}`}>{children}</span>;
}

export function Btn({
  children,
  onClick,
  variant = "default",
  primary,
  disabled,
  block,
  sm,
  title,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "danger" | "ghost";
  primary?: boolean;
  disabled?: boolean;
  block?: boolean;
  sm?: boolean;
  title?: string;
  type?: "button" | "submit";
  className?: string;
}) {
  const v = primary ? "primary" : variant;
  return (
    <button
      type={type}
      title={title}
      className={`btn ${v === "default" ? "" : v} ${block ? "block" : ""} ${sm ? "sm" : ""} ${className}`}
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}

export function Panel({
  title,
  right,
  children,
  className = "",
}: {
  title?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || right) && (
        <header className="panel-head">
          <span className="panel-title">{title}</span>
          {right}
        </header>
      )}
      {children}
    </section>
  );
}

export function KV({ pairs }: { pairs: Array<[string, ReactNode]> }) {
  return (
    <div className="kv">
      {pairs.map(([k, v]) => (
        <div className="kv-row" key={k}>
          <span className="kv-key">{k}</span>
          <span className="kv-val">{v}</span>
        </div>
      ))}
    </div>
  );
}

/** A number that flashes when it changes — motion as information only. */
export function LiveNumber({
  value,
  className = "big-number",
  suffix,
}: {
  value: bigint;
  className?: string;
  suffix?: string;
}) {
  const prev = useRef(value);
  const [flash, setFlash] = useState(false);
  useEffect(() => {
    if (prev.current !== value) {
      prev.current = value;
      setFlash(true);
      const t = window.setTimeout(() => setFlash(false), 420);
      return () => window.clearTimeout(t);
    }
  }, [value]);
  return (
    <span className={`${className} numeric`}>
      <span style={{ transition: "color 240ms ease", color: flash ? "var(--accent)" : undefined }}>
        {near(value)}
      </span>
      {suffix && <span className="faint" style={{ fontSize: "0.5em", marginLeft: 6 }}>{suffix}</span>}
    </span>
  );
}

/* ----------------------------------------------------------------- charts */

export function Bars({ data, height = 120 }: { data: bigint[]; height?: number }) {
  const w = 300;
  const max = Math.max(1, ...data.map((d) => Number(d)));
  const bw = w / data.length;
  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label="Daily revenue, last 30 days">
        {data.map((d, i) => {
          const h = (Number(d) / max) * (height - 6);
          return (
            <rect
              key={i}
              className="chart-bar"
              x={i * bw + bw * 0.18}
              y={height - h}
              width={bw * 0.64}
              height={Math.max(1, h)}
              rx={0.4}
            >
              <title>{near(d)} NEAR</title>
            </rect>
          );
        })}
      </svg>
      <div className="row between" style={{ marginTop: 4 }}>
        <span className="faint mono" style={{ fontSize: 9.5, letterSpacing: "0.08em" }}>30D AGO</span>
        <span className="faint mono" style={{ fontSize: 9.5, letterSpacing: "0.08em" }}>TODAY</span>
      </div>
    </div>
  );
}

export function Spark({ data, width = 84, height = 26 }: { data: bigint[]; width?: number; height?: number }) {
  const max = Math.max(1, ...data.map((d) => Number(d)));
  const step = width / Math.max(1, data.length - 1);
  const pts = data.map((d, i) => `${i * step},${height - (Number(d) / max) * height}`).join(" ");
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden="true">
      <polyline
        points={pts}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="1.5"
        strokeLinejoin="round"
        opacity="0.85"
      />
    </svg>
  );
}

/* ------------------------------------------------------------------ meter */

export function Meter({ value, max }: { value: bigint; max: bigint }) {
  const ratio = max > 0n ? Math.min(1, Number(value) / Number(max)) : 0;
  const tone = ratio >= 0.999 ? "bad" : ratio >= 0.75 ? "warn" : "";
  return (
    <div className={`meter ${tone}`} role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(ratio * 100)}>
      <span style={{ width: `${Math.max(ratio * 100, ratio > 0 ? 2 : 0)}%` }} />
    </div>
  );
}

/* ----------------------------------------------------------------- drawer */

export function Drawer({
  open,
  onClose,
  title,
  subtitle,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: ReactNode;
  children: ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="drawer-scrim" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="row between" style={{ marginBottom: 14 }}>
          <div>
            <h3>{title}</h3>
            {subtitle && <div className="faint small mono">{subtitle}</div>}
          </div>
          <Btn sm variant="ghost" onClick={onClose} title="Close">
            close ✕
          </Btn>
        </div>
        {children}
      </aside>
    </>
  );
}

export function ReceiptView({ lines }: { lines: string[] }) {
  return (
    <pre className="receipt">
      {lines.map((l, i) => {
        const cls = /error|E\d\d|reject|does not exist/i.test(l)
          ? "e"
          : /SuccessValue|applied|settled/.test(l)
            ? "ok"
            : "";
        if (l.startsWith("EVENT_JSON:")) {
          try {
            const pretty = JSON.stringify(JSON.parse(l.slice("EVENT_JSON:".length)), null, 2);
            return (
              <div key={i}>
                <span className="k">EVENT_JSON</span>
                {"\n"}
                {pretty}
              </div>
            );
          } catch {
            /* fall through to raw */
          }
        }
        return (
          <div key={i} className={cls}>
            {l}
          </div>
        );
      })}
    </pre>
  );
}

/* ------------------------------------------------------------------ toasts */

export function Toasts({ items }: { items: Array<{ id: number; text: string; tone: string }> }) {
  if (items.length === 0) return null;
  return (
    <div className="toasts" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.tone === "plain" ? "" : t.tone}`}>
          {t.text}
        </div>
      ))}
    </div>
  );
}
