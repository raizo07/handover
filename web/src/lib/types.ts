/** Domain types. Amounts are yoctoNEAR as bigint — never floats. */

export type RotationState = "none" | "pending" | "applied" | "failed";

export interface Rules {
  maxSpendPerEpoch: bigint;
  maxSingleSpend: bigint;
  epochSecs: number;
  allowRecipients: string[];
  claimCooldownSecs: number;
  rulesDelaySecs: number;
}

export interface Stats {
  revenueTotal: bigint;
  claimedTotal: bigint;
  pendingDividend: bigint;
  spentEpoch: bigint;
  epochStart: number;
  treasuryEstimate: bigint;
  lastClaimAt: number;
  createdAt: number;
  halted: boolean;
}

export type FeedKind =
  | "sale"
  | "spend"
  | "blocked"
  | "claim"
  | "halt"
  | "resume"
  | "rules"
  | "rotation";

export interface FeedEvent {
  id: string;
  at: number;
  kind: FeedKind;
  amount?: bigint;
  note?: string;
  to?: string;
  code?: string;
  desc: string;
}

export interface Business {
  tokenId: string;
  name: string;
  kind: string;
  tagline: string;
  vault: string;
  holder: string;
  operator: string;
  epoch: number;
  stats: Stats;
  rules: Rules;
  pendingRules: { rules: Rules; at: number } | null;
  rotation: RotationState;
  rotationEpoch: number | null;
  feed: FeedEvent[];
  /** 30 daily revenue points in yocto, oldest first. */
  history: bigint[];
}

export interface Receipt {
  ok: boolean;
  code?: string;
  message: string;
  logs: string[];
  at: number;
  txHash?: string;
}

export interface OwnerKey {
  id: string;
  publicKey: string;
  secretKey?: string;
  label: string;
  createdAt: number;
}

export const E = {
  NOT_HOLDER: "E04",
  ROTATION_IN_FLIGHT: "E06",
  NO_OWNER_KEY: "E07",
  BAD_OWNER_KEY: "E08",
  SELF_TRANSFER: "E09",
  SPEND_CAP: "E20",
  EPOCH_CAP: "E21",
  RECIPIENT: "E22",
  HALTED: "E23",
  NOT_CONTROLLER: "E24",
  STALE_EPOCH: "E25",
  NOT_SELF: "E26",
  COOLDOWN: "E27",
  NOTHING_TO_CLAIM: "E28",
  TIMELOCK: "E29",
  NO_PENDING_RULES: "E30",
  FREE_TREASURY: "E31",
  BAD_RULES: "E32",
} as const;

export const CODE_TEXT: Record<string, string> = {
  E20: "exceeds per-call cap",
  E21: "exceeds epoch cap",
  E22: "recipient not allowed",
  E23: "operator is halted",
  E27: "claim cooldown",
  E28: "nothing to claim",
  E29: "rules are timelocked",
  E31: "exceeds free treasury",
  E32: "invalid rules",
};

/** What the current data source can actually do. The UI disables what it cannot. */
export interface Capabilities {
  /** real chain data (false = local simulation) */
  live: boolean;
  /** vault operations: claim / halt / charter — signed by the business key */
  vaultActions: boolean;
  /** registry operations: buy / sell / resolve_rotation */
  registryActions: boolean;
  /** a wallet is required to sign registry actions */
  wallet: boolean;
}
