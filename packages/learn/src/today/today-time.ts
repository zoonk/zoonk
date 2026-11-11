import { type DayState } from "@zoonk/core/sessions/day-state";
import { type SessionMinutes } from "@zoonk/core/sessions/session-minutes";
import { type DayStep } from "../session/session-types";
import { isFinished } from "./today-queue";

type TimedStep = Pick<DayStep, "estimatedMinutes" | "status">;

type TimedDay = {
  blocks: readonly TimedStep[];
  lessonsComing: boolean;
  lessonsToPrepare: boolean;
  minutes: Pick<SessionMinutes, "left">;
  state: DayState;
};

function sumMinutes(blocks: readonly Pick<DayStep, "estimatedMinutes">[]): number {
  return blocks.reduce((total, block) => total + block.estimatedMinutes, 0);
}

/** A finished day says what was studied; any other day says the server's time left, never a sum of its rows. */
export function getDayTime({
  day,
  studied,
}: {
  day: Pick<TimedDay, "minutes" | "state">;
  studied: number;
}): { kind: "left" | "studied"; minutes: number } | null {
  if (day.state === "done") {
    return studied > 0 ? { kind: "studied", minutes: studied } : null;
  }

  return day.minutes.left > 0 ? { kind: "left", minutes: day.minutes.left } : null;
}

/** Time the day holds for lessons not on its list yet. */
export function getHeldMinutes(day: Omit<TimedDay, "state">): number {
  if (!day.lessonsComing && !day.lessonsToPrepare) {
    return 0;
  }

  return Math.max(
    0,
    day.minutes.left - sumMinutes(day.blocks.filter((block) => !isFinished(block))),
  );
}

/** What's left beyond the rows above the fold, so the time held for unwritten lessons sits inside it. */
export function getFoldMinutes({
  hasHiddenRows,
  left,
  shown,
}: {
  hasHiddenRows: boolean;
  left: number;
  shown: readonly Pick<DayStep, "estimatedMinutes">[];
}): number | undefined {
  return hasHiddenRows ? Math.max(0, left - sumMinutes(shown)) : undefined;
}
