import { type PlanTimeAdvice, type PlanTimeToCover } from "@zoonk/core/plans/time-advice-contract";

export type TimeLine =
  | { kind: "asking" }
  | { kind: "askFailed" }
  | { kind: "findFailed" }
  | { kind: "finish"; endDate: string }
  | { kind: "noDays" }
  | { kind: "noFinish" }
  | { kind: "pastDate" }
  /** `focus`: the suggestion is capped, so the plan starts with what matters most. */
  | { focus: boolean; kind: "suggestion"; minutes: number }
  | { kind: "working" };

export type LineAdvice = Pick<PlanTimeAdvice, "endDate">;

const BUSY_LINES = new Set<TimeLine["kind"]>(["asking", "working"]);

export function isBusyLine(line: TimeLine): boolean {
  return BUSY_LINES.has(line.kind);
}

export function getSuggestedMinutes(found: PlanTimeToCover | null): number | null {
  return found?.suggested?.minutes ?? null;
}

/** The suggestion, offered while a shorter time is picked. */
export function getOffer({
  line,
  minutes,
}: {
  line: TimeLine;
  minutes: number | null;
}): number | null {
  return line.kind === "suggestion" && minutes !== null && minutes < line.minutes
    ? line.minutes
    : null;
}

function getDatedLine({
  findFailed,
  found,
}: {
  findFailed: boolean;
  found: PlanTimeToCover | null;
}): TimeLine {
  if (!found) {
    return { kind: findFailed ? "findFailed" : "working" };
  }

  if (found.pastDate) {
    return { kind: "pastDate" };
  }

  const { suggested } = found;

  return suggested
    ? { focus: suggested.kind === "focus", kind: "suggestion", minutes: suggested.minutes }
    : { kind: "findFailed" };
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
 * A dated goal's line is the plan's suggestion (`found`), whatever the time picked; an undated
 * goal's is when the time picked finishes it (`advice`). Either is null while it's being asked for.
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

  return dated ? getDatedLine({ findFailed, found }) : getFinishLine({ advice, askFailed });
}
