import { type PlanTimeAdvice, type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";

export type TimeLine =
  | { kind: "asking" }
  | { kind: "askFailed" }
  | { kind: "everything" }
  | { kind: "findFailed" }
  | { kind: "finish"; endDate: string }
  | { coveredShare: number; kind: "focus" }
  | { kind: "noDays" }
  | { kind: "noFinish" }
  | { kind: "pastDate" }
  | { kind: "share"; share: number }
  | { kind: "working" };

export type LineAdvice = Pick<PlanTimeAdvice, "coveredShare" | "endDate">;

const BUSY_LINES = new Set<TimeLine["kind"]>(["asking", "working"]);

export function isBusyLine(line: TimeLine): boolean {
  return BUSY_LINES.has(line.kind);
}

export function getSuggestedMinutes(found: PlanTimeToCover | null): number | null {
  return found?.suggested?.minutes ?? null;
}

export type FullTime = { coveredShare: number; everything: boolean; minutes: number };

/**
 * The time that covers the most: what covers everything, or as much as any time does when part
 * never fits. More time than this buys more practice, not more coverage.
 */
export function getFullTime(found: PlanTimeToCover | null): FullTime | null {
  const minutes = found?.recommendedMinutes ?? null;

  if (minutes !== null) {
    return { coveredShare: 1, everything: true, minutes };
  }

  return found?.most ? { ...found.most, everything: false } : null;
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
 * Beside a focus suggestion, the longer time that covers more: what covers everything, as much as
 * any time does, or null when no day covers everything. Undefined when there's none to mention.
 */
export function getLongerTime(found: PlanTimeToCover | null): FullTime | null | undefined {
  const suggested = found?.suggested;

  if (!suggested || suggested.kind !== "focus") {
    return undefined;
  }

  const full = getFullTime(found);
  return full && full.minutes <= suggested.minutes ? undefined : full;
}

/** `more`: the longest useful time where part of the goal never fits, whatever the time. */
export type TimeOffer = { kind: "everything" | "more" | "suggested"; minutes: number };

/**
 * The suggestion while another time is shown, unless that time covers everything anyway; on a
 * focus suggestion, the longest useful time.
 */
export function getOffer({
  found,
  line,
  minutes,
}: {
  found: PlanTimeToCover | null;
  line: TimeLine;
  minutes: number | null;
}): TimeOffer | null {
  const suggested = found?.suggested ?? null;

  if (!suggested) {
    return null;
  }

  if (suggested.minutes !== minutes) {
    const covered = suggested.kind === "everything" && line.kind === "everything";
    const kind = suggested.kind === "everything" ? "everything" : "suggested";
    return covered ? null : { kind, minutes: suggested.minutes };
  }

  const full = getFullTime(found);

  return suggested.kind === "focus" && full && full.minutes > suggested.minutes
    ? { kind: full.everything ? "everything" : "more", minutes: full.minutes }
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
      : { coveredShare: suggested.coveredShare, kind: "focus" };
  }

  if (advice) {
    const share = advice.coveredShare ?? 0;
    return share >= 1 ? { kind: "everything" } : { kind: "share", share };
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
