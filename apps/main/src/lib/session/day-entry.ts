import { type DayBlockRef } from "@zoonk/core/sessions/day-block";
import { type NextStopTap } from "@zoonk/learn/session/next-stop";
import { type StudyDay } from "@zoonk/learn/session/types";
import { type StudyDestination } from "./study-destination";

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
  | { destination: StudyDestination; kind: "go" }
  | { kind: "failed" }
  | { kind: "refresh" };

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

type EntryScope = { generation: number; href: string; userId: string | null };

function isCurrent({ entry, generation, href, userId }: EntryScope & { entry: DayEntry }) {
  return (
    !entry.expired &&
    entry.generation === generation &&
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
