import { type CallTimeLeft } from "../../../entitlements/_utils/evaluate-usage";
import { type EntitlementTier } from "../../../entitlements/contract";
import { getUsageRule } from "../../../entitlements/limits";
import { PRACTICE_CONVERSATION_MINUTES } from "../conversation-contract";

const SECONDS_PER_MINUTE = 60;

const DEFAULT_PRACTICE_MINUTES = 2;

export type PracticeCallLengths = {
  defaultMinutes: number;
  limit: { period: CallTimeLeft["period"] | "total"; tier: EntitlementTier } | null;
  minutes: number[];
  plusMinutes: number[];
};

function toSeconds(minutes: number): number {
  return minutes * SECONDS_PER_MINUTE;
}

function getPlusMinutes(): number[] {
  const free = getUsageRule({ kind: "conversation", tier: "free" }).daySeconds ?? 0;
  const plus = getUsageRule({ kind: "conversation", tier: "plus" }).daySeconds ?? 0;

  return PRACTICE_CONVERSATION_MINUTES.filter(
    (minutes) => toSeconds(minutes) > free && toSeconds(minutes) <= plus,
  );
}

function getDefaultMinutes(minutes: readonly number[]): number {
  return (
    minutes.findLast((length) => length <= DEFAULT_PRACTICE_MINUTES) ??
    minutes[0] ??
    DEFAULT_PRACTICE_MINUTES
  );
}

export function toPracticeCallLengths({
  left,
  tier,
}: {
  left: CallTimeLeft | null;
  tier: EntitlementTier;
}): PracticeCallLengths {
  if (tier === "guest") {
    return {
      defaultMinutes: DEFAULT_PRACTICE_MINUTES,
      limit: { period: "total", tier },
      minutes: [],
      plusMinutes: [],
    };
  }

  const minutes = PRACTICE_CONVERSATION_MINUTES.filter(
    (length) => !left || toSeconds(length) <= left.seconds,
  );

  if (minutes.length === 0 && left) {
    return {
      defaultMinutes: DEFAULT_PRACTICE_MINUTES,
      limit: { period: left.period, tier },
      minutes: [],
      plusMinutes: [],
    };
  }

  return {
    defaultMinutes: getDefaultMinutes(minutes),
    limit: null,
    minutes,
    plusMinutes: tier === "free" ? getPlusMinutes() : [],
  };
}
