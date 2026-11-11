import { type PlanItem, type StudyFreshStart } from "@zoonk/db";
import { type StudyDayProgress } from "../completion-queue-contract";
import { isCatchUpItem } from "./catch-up";

const PERCENT = 100;

type SessionBar = { completed: number; total: number };

function getLead({
  complete,
  reserved,
  sessionBar,
}: {
  complete: boolean;
  reserved: boolean;
  sessionBar: SessionBar;
}): StudyDayProgress["lead"] {
  if (complete) {
    return "complete";
  }

  if (reserved) {
    return "open";
  }

  return sessionBar.completed <= sessionBar.total - sessionBar.completed ? "done" : "left";
}

function getPercent({
  lead,
  sessionBar,
}: {
  lead: StudyDayProgress["lead"];
  sessionBar: SessionBar;
}): number | null {
  if (lead === "open" || sessionBar.total === 0) {
    return null;
  }

  if (lead === "complete") {
    return PERCENT;
  }

  return Math.min(PERCENT - 1, Math.floor((sessionBar.completed / sessionBar.total) * PERCENT));
}

/** Counts the same carried lessons Today shows as behind, so the two never disagree. */
export function getDayCatchUp({
  carriedItemIds,
  dayStart,
  freshStart,
  items,
  trialEnded,
}: {
  carriedItemIds: readonly string[];
  /** The first instant of the session's learner-local day. */
  dayStart: Date;
  freshStart: StudyFreshStart | null;
  items: readonly Pick<
    PlanItem,
    "chapterId" | "completedAt" | "id" | "kind" | "lessonId" | "status"
  >[];
  trialEnded: boolean;
}): StudyDayProgress["catchUp"] {
  if (trialEnded || freshStart === "welcomeBack") {
    return null;
  }

  const carried = new Set(carriedItemIds);
  const lessons = items.filter((item) => carried.has(item.id) && isCatchUpItem(item));
  const lessonsLeft = lessons.filter((item) => item.status === "todo").length;

  const doneToday = lessons.filter(
    (item) => item.status === "done" && item.completedAt !== null && item.completedAt >= dayStart,
  ).length;

  return lessonsLeft === 0 && doneToday === 0 ? null : { doneToday, lessonsLeft };
}

export function getDayProgress({
  catchUp,
  complete,
  lessonsComing,
  reserved,
  sessionBar,
}: {
  catchUp: StudyDayProgress["catchUp"];
  complete: boolean;
  lessonsComing: boolean;
  /** The day holds time for lessons not on the queue yet. */
  reserved: boolean;
  sessionBar: SessionBar;
}): StudyDayProgress {
  const lead = getLead({ complete, reserved, sessionBar });

  return {
    catchUp,
    lead,
    lessonsComing: lead === "open" && lessonsComing,
    percent: getPercent({ lead, sessionBar }),
  };
}
