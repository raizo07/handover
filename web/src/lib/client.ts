/** Data access.
 *
 *  Two implementations behind one interface:
 *
 *  - `demo`  — a local simulation that enforces the *same* rules as the vault
 *              contract (E20/E21/E22/E23/E27/E28/E29/E32). Capped spends and halts
 *              are rejected here for the same reasons they are rejected on chain, so
 *              the UI demonstrates a mechanism rather than an animation.
 *  - `live`  — reads from the deployed registry with near-kit. Used when
 *              VITE_REGISTRY_CONTRACT is set. Writes go through the connected wallet.
 *
 *  The interface is deliberately the contract's method names.
 */

import { DISPLAY, buildFixtures, plannedSpend } from "./fixtures";
import type { Business, FeedEvent, OwnerKey, Receipt, Rules } from "./types";
import { E } from "./types";
import { YOCTO } from "./format";

export type Mode = "demo" | "live";

export interface DataClient {
  mode: Mode;
  subscribe(fn: () => void): () => void;
  list(): Business[];
  get(tokenId: string): Business | undefined;
  claim(tokenId: string): Promise<Receipt>;
  halt(tokenId: string): Promise<Receipt>;
  resume(tokenId: string, key: OwnerKey): Promise<Receipt>;
  proposeRules(tokenId: string, rules: Rules): Promise<Receipt>;
  applyRules(tokenId: string): Promise<Receipt>;
  cancelRules(tokenId: string): Promise<Receipt>;
  operatorSpend(tokenId: string, to: string, amount: bigint): Promise<Receipt>;
  replayOperator(tokenId: string): Promise<Receipt>;
  transfer(tokenId: string, to: string, publicKey: string): Promise<Receipt>;
  resolveRotation(tokenId: string): Promise<Receipt>;
  /** demo only: advance the clock so an epoch window or timelock expires */
  fastForward?(tokenId: string, seconds: number): void;
}

const KEY = "handover.demo.v1";

interface Persisted {
  businesses: Business[];
  savedAt: number;
}

function receipt(ok: boolean, message: string, extra: Partial<Receipt> = {}): Receipt {
  return {
    ok,
    message,
    at: Date.now(),
    logs: extra.logs ?? [],
    ...extra,
  };
}

function logLine(event: string, data: Record<string, unknown>): string {
  return `EVENT_JSON:${JSON.stringify({
    standard: "handover",
    version: "1.0.0",
    event,
    data: [data],
  })}`;
}

function addFeed(b: Business, ev: Omit<FeedEvent, "id">) {
  b.feed = [{ ...ev, id: `${b.tokenId}-${ev.at}-${b.feed.length}` }, ...b.feed].slice(0, 60);
}

function rollEpoch(b: Business) {
  const windowMs = b.rules.epochSecs * 1000;
  if (Date.now() >= b.stats.epochStart + windowMs) {
    b.stats.epochStart = Date.now();
    b.stats.spentEpoch = 0n;
  }
}

/** Rules the vault enforces, mirrored exactly. */
function checkSpend(b: Business, to: string, amount: bigint): string | null {
  if (b.stats.halted) return E.HALTED;
  rollEpoch(b);
  if (amount <= 0n) return E.BAD_RULES;
  if (amount > b.rules.maxSingleSpend) return E.SPEND_CAP;
  if (b.stats.spentEpoch + amount > b.rules.maxSpendPerEpoch) return E.EPOCH_CAP;
  if (b.rules.allowRecipients.length > 0 && !b.rules.allowRecipients.includes(to)) {
    return E.RECIPIENT;
  }
  return null;
}

export function validateRules(r: Rules): string | null {
  if (r.maxSingleSpend <= 0n) return E.BAD_RULES;
  if (r.maxSingleSpend > r.maxSpendPerEpoch) return E.BAD_RULES;
  if (r.epochSecs <= 0) return E.BAD_RULES;
  return null;
}

export function createDemoClient(): DataClient {
  let listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());

  let state: Business[];
  try {
    const raw = localStorage.getItem(KEY);
    state = raw ? (JSON.parse(raw, revive) as Persisted).businesses : buildFixtures();
  } catch {
    state = buildFixtures();
  }

  const persist = () => {
    try {
      localStorage.setItem(KEY, JSON.stringify({ businesses: state, savedAt: Date.now() }, replacer));
    } catch {
      /* storage full or blocked: demo still works in memory */
    }
    notify();
  };

  /** Simulates the two-beat transfer: pending now, applied a beat later. */
  const settleRotation = (tokenId: string, epoch: number) => {
    window.setTimeout(() => {
      const b = state.find((x) => x.tokenId === tokenId);
      if (!b || b.rotation !== "pending") return;
      b.rotation = "applied";
      addFeed(b, {
        at: Date.now(),
        kind: "rotation",
        desc: `rotation applied · owner key live (epoch ${epoch})`,
      });
      persist();
    }, 1800);
  };

  const find = (tokenId: string): Business | undefined => state.find((b) => b.tokenId === tokenId);

  const client: DataClient = {
    mode: "demo",
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    list: () => state,
    get: find,

    async claim(tokenId) {
      const b = find(tokenId);
      if (!b) return receipt(false, "unknown token", { code: "E03" });
      const pending = b.stats.revenueTotal - b.stats.claimedTotal;
      if (pending <= 0n) {
        return receipt(false, "nothing to claim", {
          code: E.NOTHING_TO_CLAIM,
          logs: [logLine("dividend", { token_id: tokenId, error: "E28: nothing to claim" })],
        });
      }
      if (b.stats.lastClaimAt > 0) {
        const left = b.stats.lastClaimAt + b.rules.claimCooldownSecs * 1000 - Date.now();
        if (left > 0) {
          return receipt(false, "claim cooldown", {
            code: E.COOLDOWN,
            logs: [logLine("dividend", { token_id: tokenId, error: "E27: claim cooldown" })],
          });
        }
      }
      b.stats.claimedTotal += pending;
      b.stats.lastClaimAt = Date.now();
      addFeed(b, {
        at: Date.now(),
        kind: "claim",
        amount: pending,
        desc: "dividend claimed",
      });
      persist();
      return receipt(true, `claimed ${pending} yoctoNEAR`, {
        logs: [
          logLine("dividend", {
            token_id: tokenId,
            holder: b.holder,
            amount: pending.toString(),
            claimed_total: b.stats.claimedTotal.toString(),
          }),
          "SuccessValue: ''",
        ],
      });
    },

    async halt(tokenId) {
      const b = find(tokenId);
      if (!b) return receipt(false, "unknown token", { code: "E03" });
      if (b.stats.halted) return receipt(false, "already halted", { code: E.HALTED });
      b.stats.halted = true;
      addFeed(b, { at: Date.now(), kind: "halt", desc: "operator key deleted · halt()" });
      persist();
      return receipt(true, "operator halted: access key removed", {
        logs: [
          logLine("operator_halted", {
            token_id: tokenId,
            operator_key: "ed25519:9E8s…KEr",
          }),
          "action: DeleteKey(ed25519:9E8s…KEr)",
          "SuccessValue: ''",
        ],
      });
    },

    async resume(tokenId, key) {
      const b = find(tokenId);
      if (!b) return receipt(false, "unknown token", { code: "E03" });
      if (!b.stats.halted) return receipt(false, "operator is not halted", { code: "E33" });
      b.stats.halted = false;
      addFeed(b, { at: Date.now(), kind: "resume", desc: "operator re-armed with a scoped key" });
      persist();
      return receipt(true, "operator resumed", {
        logs: [
          logLine("operator_resumed", { token_id: tokenId, operator_key: key.publicKey }),
          "action: AddKey(ed25519, FunctionCall → record_sale,operator_spend)",
        ],
      });
    },

    async proposeRules(tokenId, rules) {
      const b = find(tokenId);
      if (!b) return receipt(false, "unknown token", { code: "E03" });
      const bad = validateRules(rules);
      if (bad) return receipt(false, "invalid rules", { code: bad });
      b.pendingRules = { rules, at: Date.now() };
      addFeed(b, { at: Date.now(), kind: "rules", desc: "charter change proposed" });
      persist();
      return receipt(true, "charter change proposed", {
        logs: [
          logLine("rules_proposed", { token_id: tokenId }),
          `delay: ${b.rules.rulesDelaySecs}s`,
        ],
      });
    },

    async applyRules(tokenId) {
      const b = find(tokenId);
      if (!b) return receipt(false, "unknown token", { code: "E03" });
      if (!b.pendingRules) return receipt(false, "no pending rules", { code: E.NO_PENDING_RULES });
      const left = b.pendingRules.at + b.rules.rulesDelaySecs * 1000 - Date.now();
      if (left > 0) {
        return receipt(false, "rules are timelocked", {
          code: E.TIMELOCK,
          logs: [logLine("rules_applied", { token_id: tokenId, error: "E29: timelocked" })],
        });
      }
      b.rules = b.pendingRules.rules;
      b.pendingRules = null;
      addFeed(b, { at: Date.now(), kind: "rules", desc: "charter updated" });
      persist();
      return receipt(true, "charter updated", { logs: [logLine("rules_applied", { token_id: tokenId })] });
    },

    async cancelRules(tokenId) {
      const b = find(tokenId);
      if (!b) return receipt(false, "unknown token", { code: "E03" });
      b.pendingRules = null;
      addFeed(b, { at: Date.now(), kind: "rules", desc: "charter change cancelled" });
      persist();
      return receipt(true, "pending charter change cancelled");
    },

    async operatorSpend(tokenId, to, amount) {
      const b = find(tokenId);
      if (!b) return receipt(false, "unknown token", { code: "E03" });
      const bad = checkSpend(b, to, amount);
      if (bad) {
        addFeed(b, {
          at: Date.now(),
          kind: "blocked",
          amount,
          to,
          code: bad,
          desc: `operator blocked · ${bad === E.EPOCH_CAP ? "epoch cap" : bad === E.SPEND_CAP ? "per-call cap" : bad === E.RECIPIENT ? "recipient not allowed" : "halted"}`,
        });
        persist();
        return receipt(false, `rejected ${bad}`, {
          code: bad,
          logs: [
            logLine("operator_spend", {
              token_id: tokenId,
              to,
              amount: amount.toString(),
              error: `${bad}: rejected`,
            }),
            `reverted: ${bad} (no transfer was made)`,
          ],
        });
      }
      b.stats.spentEpoch += amount;
      b.stats.treasuryEstimate = b.stats.treasuryEstimate > amount ? b.stats.treasuryEstimate - amount : 0n;
      addFeed(b, { at: Date.now(), kind: "spend", amount, to, desc: "operator paid supplier" });
      persist();
      return receipt(true, "spend settled", {
        logs: [
          logLine("operator_spend", {
            token_id: tokenId,
            to,
            amount: amount.toString(),
            spent_epoch: b.stats.spentEpoch.toString(),
          }),
          "SuccessValue: ''",
        ],
      });
    },

    async replayOperator(tokenId) {
      const b = find(tokenId);
      if (!b) return receipt(false, "unknown token", { code: "E03" });
      const plan = plannedSpend(b);
      return client.operatorSpend(tokenId, plan.to, plan.amount);
    },

    async transfer(tokenId, to, publicKey) {
      const b = find(tokenId);
      if (!b) return receipt(false, "unknown token", { code: "E03" });
      if (!publicKey.startsWith("ed25519:")) return receipt(false, "key must be ed25519", { code: E.BAD_OWNER_KEY });
      if (b.rotation === "pending") return receipt(false, "a transfer is already settling", { code: E.ROTATION_IN_FLIGHT });
      if (to === b.holder) return receipt(false, "already the holder", { code: E.SELF_TRANSFER });

      const from = b.holder;
      const epoch = b.epoch + 1;
      b.rotation = "pending";
      b.rotationEpoch = epoch;
      b.holder = to;
      b.epoch = epoch;
      addFeed(b, {
        at: Date.now(),
        kind: "rotation",
        desc: `rotation pending · ${from} → ${to} (epoch ${epoch})`,
      });
      persist();
      settleRotation(tokenId, epoch);
      return receipt(true, "rotation pending", {
        logs: [
          logLine("rotation_pending", { token_id: tokenId, from, to, epoch }),
          `call: set_holder(new_holder=${to}, epoch=${epoch}) on ${b.vault}`,
        ],
      });
    },

    async resolveRotation(tokenId) {
      const b = find(tokenId);
      if (!b) return receipt(false, "unknown token", { code: "E03" });
      if (b.rotation !== "failed") return receipt(false, "nothing to resolve", { code: "E16" });
      b.rotation = "pending";
      settleRotation(tokenId, b.epoch);
      return receipt(true, "retrying rotation", { logs: [logLine("rotation_pending", { token_id: tokenId })] });
    },

    fastForward(tokenId, seconds) {
      const b = find(tokenId);
      if (!b) return;
      b.stats.epochStart -= seconds * 1000;
      if (b.pendingRules) b.pendingRules.at -= seconds * 1000;
      persist();
    },
  };

  return client;
}

function replacer(_k: string, v: unknown) {
  return typeof v === "bigint" ? { __b: v.toString() } : v;
}

function revive(_k: string, v: unknown) {
  if (v && typeof v === "object" && "__b" in (v as Record<string, unknown>)) {
    return BigInt((v as { __b: string }).__b);
  }
  return v;
}

// --- live mode -------------------------------------------------------------

/** Reads the deployed registry. Writes require a connected wallet; without one the
 *  UI stays in demo mode rather than pretending. */
export async function createLiveClient(contractId: string): Promise<DataClient | null> {
  try {
    const { Near } = await import("near-kit");
    // VITE_RPC_URL lets the app read a local sandbox as well as testnet.
    const rpcUrl = import.meta.env.VITE_RPC_URL as string | undefined;
    const near = new Near(
      rpcUrl ? { network: { rpcUrl, networkId: "custom" } } : { network: "testnet" },
    );

    const view = async <T>(cid: string, method: string, args: object = {}): Promise<T | undefined> =>
      (await near.view(cid, method, args)) as T | undefined;

    const raw = (await view<unknown[]>(contractId, "nft_tokens", { from_index: "0", limit: 50 })) ?? [];
    if (!Array.isArray(raw) || raw.length === 0) return null;

    // See docs/SPEC.md §8: the live path reads the same shapes the demo simulates.
    const businesses: Business[] = [];
    for (const t of raw as Array<Record<string, unknown>>) {
      const tokenId = String(t.token_id);
      const vault = String(t.vault);
      const stats = await view<Record<string, string>>(vault, "get_stats");
      const rules = await view<Record<string, unknown>>(vault, "get_rules");
      if (!stats || !rules) continue;
      const display = DISPLAY[tokenId];
      businesses.push({
        tokenId,
        name: display?.name ?? tokenId,
        kind: display?.kind ?? "live",
        tagline: display?.tagline ?? "Deployed on testnet.",
        vault,
        holder: String(t.owner_id),
        operator: String(t.operator),
        epoch: Number(t.epoch ?? 1),
        stats: {
          revenueTotal: BigInt(stats.revenue_total ?? "0"),
          claimedTotal: BigInt(stats.claimed_total ?? "0"),
          pendingDividend: BigInt(stats.pending_dividend ?? "0"),
          spentEpoch: BigInt(stats.spent_epoch ?? "0"),
          epochStart: Number(stats.epoch_start ?? 0) / 1e6,
          treasuryEstimate: BigInt(stats.treasury_estimate ?? "0"),
          lastClaimAt: Number(stats.last_claim_at ?? 0) / 1e6,
          createdAt: Number(stats.created_at ?? 0) / 1e6,
          halted: Boolean(stats.halted),
        },
        rules: {
          maxSpendPerEpoch: BigInt(String(rules.max_spend_per_epoch ?? "0")),
          maxSingleSpend: BigInt(String(rules.max_single_spend ?? "0")),
          epochSecs: Number(rules.epoch_secs ?? 0),
          allowRecipients: (rules.allow_recipients as string[]) ?? [],
          claimCooldownSecs: Number(rules.claim_cooldown_secs ?? 0),
          rulesDelaySecs: Number(rules.rules_delay_secs ?? 0),
        },
        pendingRules: null,
        rotation: "none",
        rotationEpoch: null,
        feed: [],
        history: Array.from({ length: 30 }, () => 0n),
      });
    }

    if (businesses.length === 0) return null;

    const notWired = (m: string): Receipt =>
      receipt(false, `${m} needs a connected wallet — this build reads live state only`);

    return {
      mode: "live",
      subscribe: () => () => {},
      list: () => businesses,
      get: (id) => businesses.find((b) => b.tokenId === id),
      claim: async () => notWired("claim()"),
      halt: async () => notWired("halt()"),
      resume: async () => notWired("resume()"),
      proposeRules: async () => notWired("propose_rules()"),
      applyRules: async () => notWired("apply_rules()"),
      cancelRules: async () => notWired("cancel_rules()"),
      operatorSpend: async () => notWired("operator_spend()"),
      replayOperator: async () => notWired("operator replay"),
      transfer: async () => notWired("nft_transfer()"),
      resolveRotation: async () => notWired("resolve_rotation()"),
    };
  } catch {
    return null;
  }
}

export const YOCTO_ONE = YOCTO;
