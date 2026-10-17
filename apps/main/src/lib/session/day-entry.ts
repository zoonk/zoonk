import { type DayBlockRef } from "@zoonk/core/sessions/day-block";
import { type NextStopTap } from "@zoonk/learn/session/next-stop";
import { type StudyDay } from "@zoonk/learn/session/types";
import { type StudyDestination } from "./study-destination";

/** A reply nothing applied within this long is let go: its screen draws as it reads then. */
const ENTRY_TTL_MS = 60_000;

/**
 * What a screen held of its day when the learner tapped one of its steps: enough to draw the
 * tapped step on the session screen before any reply (its title, the day's segments, its busy
 * Start), with whose day it is.
 */
type ShownDay = {
  day: Pick<
    StudyDay,
    "blocks" | "dayEndsAt" | "lessonsComing" | "localDate" | "nextPosition" | "sessionBar"
  >;
  goalId: string;
  userId: string;
};

/** Where a step plays, as the server worked it out with core's rule (`getDayBlockScreen`). */
type StepScreen = "challenge" | "essay" | "lesson" | "session" | "unknown";

/**
 * A step a screen shows, to tap: its place in the day, its saved block's id (none before the day
 * is opened), the work it is (`ref`) and where it plays.
 */
export type TapStep = {
  blockId: string | null;
  position: number;
  ref: DayBlockRef | null;
  screen: StepScreen;
};

/** A day a screen holds: what it drew (`shown`), and its saved session once it's opened. */
export type TapDay = { sessionId: string | null; shown: ShownDay };

/**
 * What a tap's POST came to: where the step plays now that it started (`go`), the screen to read
 * again because nothing started (the step changed or left the day, the day had nothing to open, or
 * the goal can't be studied now: the screen says which once it reads itself), or a failure the
 * step says with its retry line.
 */
export type TapResult =
  | { destination: StudyDestination; kind: "go" }
  | { kind: "failed" }
  | { kind: "refresh" };

/**
 * The tap this tab just made into the session screen: the day it was made on, the step it named
 * (`next` for Start, the step's own work for a row or a chip), where it navigated (`href`), and its
 * POST's result once it arrived, which the session screen's own content applies (`applied`). Until
 * that's done the step is busy, however long the POST takes. A result nothing applied within a
 * minute, or a tap made on a day that ended, `expired`: nothing draws it.
 */
export type DayEntry = {
  applied: boolean;
  day: TapDay;
  expired: boolean;
  focusMain: boolean;
  generation: number;
  href: string;
  id: number;
  next: boolean;
  result: TapResult | null;
  step: TapStep;
  tappedAt: number;
};

/**
 * When a tap stops speaking for its step: when the day it showed ends, or a minute after its result
 * arrived (`settledAt`) if nothing applied it by then. While its POST is out it never lets go, so a
 * slow reply still moves the screen on instead of landing on a step that went idle.
 */
export function getEntryExpiry({
  dayEndsAt,
  settledAt,
}: {
  dayEndsAt: number;
  settledAt: number | null;
}): number {
  return settledAt === null ? dayEndsAt : Math.min(settledAt + ENTRY_TTL_MS, dayEndsAt);
}

/** A learner-local day as the screens name it (`YYYY-MM-DD`). */
function toDayDate(localDate: Date): string {
  return localDate.toISOString().slice(0, 10);
}

type EntryScope = { generation: number; href: string; userId: string | null };

/** Whether an entry still speaks for this tab: the same identity, the same page, not expired. */
function isCurrent({ entry, generation, href, userId }: EntryScope & { entry: DayEntry }) {
  return (
    !entry.expired &&
    entry.generation === generation &&
    (userId === null || entry.day.shown.userId === userId) &&
    entry.href === href
  );
}

/** A day a screen draws: whose goal it's for, its learner-local date and its steps. */
type DrawnDay<Step> = { blocks: readonly Step[]; goalId: string; localDate: Date };

/**
 * The step of a day a tap from this tab named, and the tap it's drawn for (`NextStopTap`): busy
 * until the tap's result is applied, or failed with its retry. Only for the identity, the page and
 * the goal's day the tap was made for, before it expired (yesterday's step is never drawn after
 * midnight), while that day holds the step still to do. The session screen draws it from the tap
 * until the result moves the screen on, in its frame and then in its own content, even when the
 * day's next step is another: a row further down Today's list opens that step, not the day's first.
 */
export function findDayTap<Step extends { position: number; status: string }>({
  day,
  ...scope
}: EntryScope & { day: DrawnDay<Step>; entry: DayEntry | null }): {
  step: Step;
  tap: NextStopTap;
} | null {
  const { entry } = scope;

  if (
    !entry ||
    !isCurrent({ ...scope, entry }) ||
    entry.day.shown.goalId !== day.goalId ||
    toDayDate(entry.day.shown.day.localDate) !== toDayDate(day.localDate)
  ) {
    return null;
  }

  const step = day.blocks.find((block) => block.position === entry.step.position);

  // A step already done (its question block finished) is no tap's to draw any more.
  if (!step || step.status === "completed" || step.status === "skipped") {
    return null;
  }

  return {
    step,
    tap: {
      focus: entry.focusMain,
      state: entry.result?.kind === "failed" ? "failed" : "opening",
      tappedAt: entry.tappedAt,
    },
  };
}
