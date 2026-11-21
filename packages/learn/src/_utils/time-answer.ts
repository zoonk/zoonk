import { type PlanTimeAdvice, type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";

export type TimeLine =
  | { kind: "asking" }
  | { kind: "askFailed" }
  | { kind: "everything" }
  | { kind: "findFailed" }
  | { kind: "finish"; endDate: string }
  | { kind: "noDays" }
  | { kind: "noFinish" }
  | { kind: "pastDate" }
  /**
   * `share` is what the time reaches: 1 when every topic is in, though not everything. Null when the
   * answer doesn't say.
   */
  | { kind: "share"; share: number | null }
  | { kind: "working" };

export type LineAdvice = Pick<PlanTimeAdvice, "coveredShare" | "endDate" | "reachedShare">;

const BUSY_LINES = new Set<TimeLine["kind"]>(["asking", "working"]);

export function isBusyLine(line: TimeLine): boolean {
  return BUSY_LINES.has(line.kind);
}

export function getSuggestedMinutes(found: PlanTimeToCover | null): number | null {
  return found?.suggested?.minutes ?? null;
}

export type FullTime = { everything: boolean; minutes: number };

/**
 * The time that covers the most: what covers everything, or as much as any time does when part
 * never fits. More time than this buys more practice, not more coverage.
 */
function getFullTime(found: PlanTimeToCover | null): FullTime | null {
  const minutes = found?.recommendedMinutes ?? null;

  if (minutes !== null) {
    return { everything: true, minutes };
  }

  return found?.most ? { everything: false, minutes: found.most.minutes } : null;
}

export function getMarkedTimes(found: PlanTimeToCover | null): {
  full: number | null;
  suggested: number | null;
} {
  return {
    full: found?.suggested?.kind === "focus" ? found.recommendedMinutes : null,
    suggested: getSuggestedMinutes(found),
  };
}

/**
 * On a focus suggestion, what covering everything takes: a time that covers it, as much as any time
 * covers, or null when no time covers everything by the date. Undefined when there's none to say.
 */
export function getEverythingTakes(found: PlanTimeToCover | null): FullTime | null | undefined {
  return found?.suggested?.kind === "focus" ? getFullTime(found) : undefined;
}

/**
 * The time that covers everything, offered while a shorter time is shown, only when that time is
 * the suggestion (so a realistic one). Null otherwise.
 */
export function getOffer({
  found,
  line,
  minutes,
}: {
  found: PlanTimeToCover | null;
  line: TimeLine;
  minutes: number | null;
}): number | null {
  const suggested = found?.suggested;

  return suggested?.kind === "everything" &&
    suggested.minutes !== minutes &&
    line.kind !== "everything"
    ? suggested.minutes
    : null;
}

function getDatedLine({
  advice,
  askFailed,
  findFailed,
  found,
  minutes,
}: {
  advice: LineAdvice | null;
  askFailed: boolean;
  findFailed: boolean;
  found: PlanTimeToCover | null;
  minutes: number;
}): TimeLine {
  if (found?.pastDate) {
    return { kind: "pastDate" };
  }

  const suggested = found?.suggested;

  if (suggested?.minutes === minutes) {
    return suggested.kind === "everything"
      ? { kind: "everything" }
      : { kind: "share", share: suggested.reachedShare };
  }

  if (advice) {
    return (advice.coveredShare ?? 0) >= 1
      ? { kind: "everything" }
      : { kind: "share", share: advice.reachedShare };
  }

  if (!found) {
    return { kind: findFailed ? "findFailed" : "working" };
  }

  return { kind: askFailed ? "askFailed" : "asking" };
}

function getFinishLine({
  advice,
  askFailed,
}: {
  advice: LineAdvice | null;
  askFailed: boolean;
}): TimeLine {
  if (!advice) {
    return { kind: askFailed ? "askFailed" : "asking" };
  }

  return advice.endDate ? { endDate: advice.endDate, kind: "finish" } : { kind: "noFinish" };
}

/**
 * `found` is the plan's answer for the days shown, `advice` what the time shown covers on them;
 * either is null while it's being asked for.
 */
export function getTimeLine({
  advice,
  askFailed,
  dated,
  findFailed,
  found,
  hasDays,
  minutes,
}: {
  advice: LineAdvice | null;
  askFailed: boolean;
  dated: boolean;
  findFailed: boolean;
  found: PlanTimeToCover | null;
  hasDays: boolean;
  minutes: number | null;
}): TimeLine {
  if (!hasDays) {
    return { kind: "noDays" };
  }

  if (minutes === null) {
    return { kind: "working" };
  }

  return dated
    ? getDatedLine({ advice, askFailed, findFailed, found, minutes })
    : getFinishLine({ advice, askFailed });
}
