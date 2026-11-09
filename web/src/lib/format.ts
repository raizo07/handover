/** Formatting. All money maths is bigint yocto; only display is float. */

export const YOCTO = 1_000_000_000_000_000_000_000_000n;

export function toNear(yocto: bigint): number {
  return Number(yocto / 1_000_000_000n) / 1e15;
}

/** 12.4823 NEAR — 4 decimals, thousands separated. */
export function near(yocto: bigint, dp = 2): string {
  const v = toNear(yocto);
  if (v === 0) return "0";
  if (v < 0.0001) return "<0.0001";
  return v.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: dp,
  });
}

export function nearWithUnit(yocto: bigint, dp = 2): string {
  return `${near(yocto, dp)} NEAR`;
}

export function pct(n: number, dp = 1): string {
  return `${n >= 0 ? "" : ""}${n.toFixed(dp)}%`;
}

/** Relative time: "4s", "12m", "3h", "2d". */
export function ago(at: number, now = Date.now()): string {
  const s = Math.max(0, Math.round((now - at) / 1000));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.round(s / 60)}m`;
  if (s < 86400) return `${Math.round(s / 3600)}h`;
  return `${Math.round(s / 86400)}d`;
}

export function clock(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export function shortKey(k?: string): string {
  if (!k) return "—";
  const body = k.includes(":") ? k.split(":")[1] : k;
  return `${body.slice(0, 4)}…${body.slice(-4)}`;
}

export function shortAccount(a?: string): string {
  if (!a) return "—";
  if (a.length <= 18) return a;
  return `${a.slice(0, 8)}…${a.slice(-6)}`;
}

export function clamp(n: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, n));
}

/** Fixed-width time left, e.g. 00:14 */
export function countdown(msLeft: number): string {
  const s = Math.max(0, Math.ceil(msLeft / 1000));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return `${h}h ${String(m).padStart(2, "0")}m`;
  }
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
