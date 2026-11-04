import { type LearnerId, isSameLearner } from "@/lib/learner/learner-snapshot";
import { type DayBlockRef } from "@zoonk/core/sessions/day-block";
import { type StudyBlockOpening } from "@zoonk/core/sessions/open-block-contract";
import { type NextStopTap } from "@zoonk/learn/session/next-stop";
import { type StudyDay } from "@zoonk/learn/session/types";

const ENTRY_TTL_MS = 60_000;

type ShownDay = {
  day: Pick<
    StudyDay,
    "blocks" | "dayEndsAt" | "lessonsComing" | "localDate" | "nextPosition" | "sessionBar"
  >;
  goalId: string;
  userId: string;
};

type StepScreen = "challenge" | "essay" | "lesson" | "session" | "unknown";

export type TapStep = {
  blockId: string | null;
  position: number;
  ref: DayBlockRef | null;
  screen: StepScreen;
};

export type TapDay = { sessionId: string | null; shown: ShownDay };

export type TapResult =
  | { destination: StudyBlockOpening; kind: "go" }
  | { kind: "failed" }
  | { kind: "refresh" };

export type DayEntry = {
  applied: boolean;
  day: TapDay;
  expired: boolean;
  focusMain: boolean;
  href: string;
  id: number;
  learner: LearnerId;
  next: boolean;
  result: TapResult | null;
  shown: boolean;
  step: TapStep;
  tappedAt: number;
};

/**
 * Whether the learner left the screen a tap opens: they're anywhere else, or back where they tapped
 * once the step showed there. Until it shows, the screen they tapped on is still on its way to it.
 */
export function hasLeftEntry({
  at,
  entry,
  learner,
  origin,
}: {
  at: string;
  entry: Pick<DayEntry, "href" | "learner" | "shown">;
  learner: LearnerId;
  origin: string;
}): boolean {
  return (
    !isSameLearner(entry.learner, learner) || (at !== entry.href && (entry.shown || at !== origin))
  );
}

/** While its POST is out it never lets go, so a slow reply still moves the screen on. */
export function getEntryExpiry({
  dayEndsAt,
  settledAt,
}: {
  dayEndsAt: number;
  settledAt: number | null;
}): number {
  return settledAt === null ? dayEndsAt : Math.min(settledAt + ENTRY_TTL_MS, dayEndsAt);
}

function toDayDate(localDate: Date): string {
  return localDate.toISOString().slice(0, 10);
}

type EntryScope = { href: string; learner: LearnerId; userId: string | null };

function isCurrent({ entry, href, learner, userId }: EntryScope & { entry: DayEntry }) {
  return (
    !entry.expired &&
    isSameLearner(entry.learner, learner) &&
    (userId === null || entry.day.shown.userId === userId) &&
    entry.href === href
  );
}

type DrawnDay<Step> = { blocks: readonly Step[]; goalId: string; localDate: Date };

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
