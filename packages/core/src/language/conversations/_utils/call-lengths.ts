import { type CallTimeLeft } from "../../../entitlements/_utils/evaluate-usage";
import { type EntitlementTier } from "../../../entitlements/contract";
import { getLongestCallSeconds } from "../../../entitlements/limits";
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

function getTierMinutes(tier: EntitlementTier): number[] {
  return PRACTICE_CONVERSATION_MINUTES.filter(
    (minutes) => toSeconds(minutes) <= getLongestCallSeconds(tier),
  );
}

function getPlusMinutes(): number[] {
  const free = getTierMinutes("free");
  return getTierMinutes("plus").filter((minutes) => !free.includes(minutes));
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

  if (left && left.seconds <= 0) {
    return {
      defaultMinutes: DEFAULT_PRACTICE_MINUTES,
      limit: { period: left.period, tier },
      minutes: [],
      plusMinutes: [],
    };
  }

  const minutes = getTierMinutes(tier);

  return {
    defaultMinutes: getDefaultMinutes(minutes),
    limit: null,
    minutes,
    plusMinutes: tier === "free" ? getPlusMinutes() : [],
  };
}
