import { type CallTimeLeft } from "../../../entitlements/_utils/evaluate-usage";
import { type EntitlementTier } from "../../../entitlements/contract";
import { getUsageRule } from "../../../entitlements/limits";
import { PRACTICE_CONVERSATION_MINUTES } from "../conversation-contract";

const SECONDS_PER_MINUTE = 60;

/** A practice call starts at two minutes unless the learner picks another length. */
const DEFAULT_PRACTICE_MINUTES = 2;

export type PracticeCallLengths = {
  defaultMinutes: number;
  /** The call time that's used when no length fits, which says until when calls come back. */
  limit: { period: CallTimeLeft["period"] | "total"; tier: EntitlementTier } | null;
  /** The lengths that fit what's left of the learner's call time. */
  minutes: number[];
  /** Longer lengths a free learner's day can't hold and Plus's can: they show locked. */
  plusMinutes: number[];
};

function toSeconds(minutes: number): number {
  return minutes * SECONDS_PER_MINUTE;
}

/** Lengths beyond the free plan's day that Plus's day holds, which a free learner sees locked. */
function getPlusMinutes(): number[] {
  const free = getUsageRule({ kind: "conversation", tier: "free" }).daySeconds ?? 0;
  const plus = getUsageRule({ kind: "conversation", tier: "plus" }).daySeconds ?? 0;

  return PRACTICE_CONVERSATION_MINUTES.filter(
    (minutes) => toSeconds(minutes) > free && toSeconds(minutes) <= plus,
  );
}

/** The usual two minutes when they fit, else the longest length that fits below them. */
function getDefaultMinutes(minutes: readonly number[]): number {
  return (
    minutes.findLast((length) => length <= DEFAULT_PRACTICE_MINUTES) ??
    minutes[0] ??
    DEFAULT_PRACTICE_MINUTES
  );
}

/**
 * The lengths a learner picks a practice call from: only those that fit what's left of their
 * plan's call time today and this month (`left`), so a call never stops short of the length they
 * chose, and for a free learner the longer ones Plus holds, locked, never hidden. Once no length
 * fits, the call time that's used says until when calls come back instead; a guest's plan has no
 * calls. The lengths never show how much call time a plan has.
 */
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
