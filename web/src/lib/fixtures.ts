/** Deterministic seed data. Regenerated from a fixed seed so every screenshot,
 *  recording and test run shows the same numbers. Replaced by chain reads when a
 *  registry contract is configured. */

import type { Business, FeedEvent, Rules } from "./types";
import { YOCTO } from "./format";

/** mulberry32 — tiny deterministic PRNG. */
function rng(seed: number) {
  return function next() {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const n = (v: number) => BigInt(Math.round(v * 1e6)) * (YOCTO / 1_000_000n);

const RULES = {
  biz7: {
    maxSpendPerEpoch: n(2),
    maxSingleSpend: n(0.5),
    epochSecs: 86_400,
    allowRecipients: ["supplier.coffee.testnet", "roastery.rent.testnet"] as string[],
    claimCooldownSecs: 0,
    rulesDelaySecs: 0,
  } satisfies Rules,
  biz3: {
    maxSpendPerEpoch: n(1.2),
    maxSingleSpend: n(0.4),
    epochSecs: 86_400,
    allowRecipients: [] as string[],
    claimCooldownSecs: 3_600,
    rulesDelaySecs: 0,
  } satisfies Rules,
  biz9: {
    maxSpendPerEpoch: n(4),
    maxSingleSpend: n(1.5),
    epochSecs: 21_600,
    allowRecipients: [] as string[],
    claimCooldownSecs: 0,
    rulesDelaySecs: 60,
  } satisfies Rules,
};

interface Seed {
  tokenId: string;
  name: string;
  kind: string;
  tagline: string;
  holder: string;
  operator: string;
  vault: string;
  epoch: number;
  rules: Rules;
  base: number;
  vol: number;
  revenue: number;
  claimed: number;
  seed: number;
}

const SEEDS: Seed[] = [
  {
    tokenId: "biz-7",
    name: "Oja Coffee Works",
    kind: "Roastery",
    tagline: "Roasts twice a week, sells to four cafés, never closed.",
    holder: "tola.testnet",
    operator: "agent.coffee.testnet",
    vault: "biz-7.reg.raizo07.testnet",
    epoch: 3,
    rules: RULES.biz7,
    base: 1.35,
    vol: 0.5,
    revenue: 61.4,
    claimed: 48.9,
    seed: 7,
  },
  {
    tokenId: "biz-3",
    name: "Balogun Textiles",
    kind: "Fabric",
    tagline: "Bulk cloth by the bolt. Two suppliers, one loom.",
    holder: "adaeze.testnet",
    operator: "agent.textile.testnet",
    vault: "biz-3.reg.raizo07.testnet",
    epoch: 2,
    rules: RULES.biz3,
    base: 0.82,
    vol: 0.24,
    revenue: 34.1,
    claimed: 31.6,
    seed: 3,
  },
  {
    tokenId: "biz-9",
    name: "Third Mainland Freight",
    kind: "Logistics",
    tagline: "Pallet runs across the lagoon. Paid per delivery, same day.",
    holder: "emeka.testnet",
    operator: "agent.freight.testnet",
    vault: "biz-9.reg.raizo07.testnet",
    epoch: 5,
    rules: RULES.biz9,
    base: 2.4,
    vol: 1.5,
    revenue: 118.2,
    claimed: 104.0,
    seed: 9,
  },
];

function historyFor(seed: Seed): bigint[] {
  const rand = rng(seed.seed);
  const out: bigint[] = [];
  for (let i = 0; i < 30; i++) {
    const wobble = Math.sin(i / 3.1) * seed.vol * 0.4;
    const v = Math.max(0.05, seed.base + wobble + (rand() - 0.5) * seed.vol);
    out.push(n(v));
  }
  return out;
}

function feedFor(seed: Seed, now: number): FeedEvent[] {
  const rand = rng(seed.seed * 31);
  const names = ["beans", "order #4412", "two bolts", "pallet run", "restock", "café order"];
  const events: FeedEvent[] = [];
  let t = now;
  const kinds: Array<FeedEvent["kind"]> = ["sale", "sale", "spend", "sale", "blocked", "sale", "spend"];

  for (let i = 0; i < 13; i++) {
    const kind = kinds[Math.floor(rand() * kinds.length)];
    t -= Math.round(90_000 + rand() * 1_500_000);
    const amount = kind === "spend" ? n(0.08 + rand() * 0.34) : n(0.2 + rand() * 1.1);
    const base = {
      id: `${seed.tokenId}-${i}`,
      at: t,
      amount,
      kind,
    };
    if (kind === "sale") {
      events.push({ ...base, desc: `sale · ${names[Math.floor(rand() * names.length)]}` });
    } else if (kind === "spend") {
      const to = seed.rules.allowRecipients[0] ?? "supplier.testnet";
      events.push({ ...base, to, desc: "operator paid supplier" });
    } else {
      events.push({
        ...base,
        kind: "blocked",
        code: "E22",
        desc: "operator blocked · recipient not allowed",
      });
    }
  }
  return events;
}

/** Display names by token id — used by the demo data and by live mode, so a deployed
 *  registry shows "Oja Coffee Works" instead of "biz-7". */
export const DISPLAY: Record<string, { name: string; kind: string; tagline: string }> = Object.fromEntries(
  SEEDS.map((s) => [s.tokenId, { name: s.name, kind: s.kind, tagline: s.tagline }]),
);

export function buildFixtures(now = Date.now()): Business[] {
  return SEEDS.map((seed) => {
    const history = historyFor(seed);
    const revenueTotal = n(seed.revenue);
    const claimedTotal = n(seed.claimed);
    return {
      tokenId: seed.tokenId,
      name: seed.name,
      kind: seed.kind,
      tagline: seed.tagline,
      vault: seed.vault,
      holder: seed.holder,
      operator: seed.operator,
      epoch: seed.epoch,
      stats: {
        revenueTotal,
        claimedTotal,
        pendingDividend: revenueTotal - claimedTotal,
        spentEpoch: n(seed.revenue % 0.7),
        epochStart: now - 3_600_000,
        treasuryEstimate: n(seed.revenue * 0.35),
        lastClaimAt: now - 86_400_000,
        createdAt: now - 90 * 86_400_000,
        halted: false,
      },
      rules: seed.rules,
      pendingRules: null,
      rotation: "applied",
      rotationEpoch: seed.epoch,
      feed: feedFor(seed, now),
      history,
    };
  });
}

/** The spend the operator will attempt when you press "replay operator".
 *  Deliberately close to the cap so dragging the slider is visible. */
export function plannedSpend(b: Business): { to: string; amount: bigint } {
  const to = b.rules.allowRecipients[0] ?? "supplier.testnet";
  const amount = b.rules.maxSingleSpend / 2n + b.rules.maxSingleSpend / 8n;
  return { to, amount };
}
