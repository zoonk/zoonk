import { type UsageKind } from "@zoonk/db";

export type EntitlementTier = "free" | "guest" | "plus";

export type UsagePeriod = "day" | "month" | "total";

type AllowanceResource = UsageKind | "activeGoals" | "aiSpend" | "callSeconds" | "generatedLessons";

export type AllowanceLimit = {
  limit: number;
  period: UsagePeriod;
  resource: AllowanceResource;
  tier: EntitlementTier;
};

/** slowDown retries after retryAfterSeconds; limitReached waits for a cap reset. signUpRequired moves guest work into an account. */
export type UsageDecision =
  | { heldSeconds?: number; shortenedBy?: "day" | "month"; status: "allowed" }
  | { limit: AllowanceLimit; status: "limitReached" }
  | { retryAfterSeconds: number; status: "slowDown" }
  | { status: "signUpRequired" }
  | { status: "unauthorized" };

export type RefusedUsage = Exclude<UsageDecision, { status: "allowed" | "unauthorized" }>;

const REFUSED_USAGE_STATUSES: ReadonlySet<string> = new Set<RefusedUsage["status"]>([
  "limitReached",
  "signUpRequired",
  "slowDown",
]);

export function isRefusedUsage<TResult extends { status: string }>(
  result: TResult,
): result is Extract<TResult, { status: RefusedUsage["status"] }> {
  return REFUSED_USAGE_STATUSES.has(result.status);
}

export type AllowanceItem = {
  dailyLimit: number | null;
  /** Above this many uses a day, new uses are spaced out instead of blocked. */
  fairUseDailyLimit: number | null;
  kind: UsageKind;
  monthlyLimit: number | null;
  /** Uses left before a hard cap, or null when the plan only has fair use. */
  remaining: number | null;
  totalLimit: number | null;
  usedThisMonth: number;
  usedToday: number;
  usedTotal: number;
};

export type Allowance = {
  activeGoals: { limit: number | null; used: number };
  /** Null limits mean uncapped; usage includes held reservations. */
  callTime: {
    limitSeconds: number | null;
    monthLimitSeconds: number | null;
    usedSeconds: number;
    usedSecondsThisMonth: number;
  };
  /** A null studyDays value includes the full exam plan. */
  examPrep: { includesMockExams: boolean; studyDays: number | null };
  /** A guest's newly generated lessons; null for accounts. */
  generatedLessons: { limit: number; used: number } | null;
  items: AllowanceItem[];
  resets: { day: Date; month: Date };
  tier: EntitlementTier;
};

function isUsedUp(limit: number | null, used: number): boolean {
  return limit !== null && used >= limit;
}

/** Returns null while capacity remains or only fair use applies; checks total, month, then day. */
export function getReachedCap({
  allowance,
  kind,
}: {
  allowance: Pick<Allowance, "items" | "tier">;
  kind: UsageKind;
}): { period: UsagePeriod; status: "limitReached"; tier: EntitlementTier } | null {
  const item = allowance.items.find((entry) => entry.kind === kind);

  if (!item || item.remaining === null || item.remaining > 0) {
    return null;
  }

  const period = [
    isUsedUp(item.totalLimit, item.usedTotal) && ("total" as const),
    isUsedUp(item.monthlyLimit, item.usedThisMonth) && ("month" as const),
  ].find((value) => value !== false);

  return { period: period ?? "day", status: "limitReached", tier: allowance.tier };
}
