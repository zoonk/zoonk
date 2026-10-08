import { type PlanDayView, type PlanItemView, type PlanView } from "../plan-view-contract";
import {
  type StudyCalendar,
  addDays,
  getEndOfWeek,
  getStartOfWeek,
  toIsoDate,
} from "../planner/plan-calendar";
import { type ExamDayRules, getPlannedMinutes } from "../planner/plan-days";
import { type ExistingPlanItem, getItemKey } from "../planner/plan-items";
import { DAYS_PER_WEEK } from "../planner/plan-state";
import { type SkillAreas, getWritingTitle, isWritingItem } from "./plan-phase-views";

type ItemAccess = { freeUntil: string | null; mocksRequirePlus: boolean };

/** Free exam plans stop at their first week, and mock exams need Plus. */
function requiresPlus({ access, item }: { access: ItemAccess; item: ExistingPlanItem }): boolean {
  if (item.kind === "mock" && access.mocksRequirePlus) {
    return true;
  }

  return Boolean(
    access.freeUntil && item.scheduledFor && toIsoDate(item.scheduledFor) > access.freeUntil,
  );
}

function toPlanItemView({
  access,
  item,
  minutes,
  skillAreas,
}: {
  access: ItemAccess;
  item: ExistingPlanItem;
  minutes: ReadonlyMap<string, number>;
  skillAreas: SkillAreas;
}): PlanItemView {
  const itemMinutes = minutes.get(getItemKey(item));
  const writing = isWritingItem(item);

  return {
    chapterId: item.chapterId,
    id: item.id,
    kind: item.kind,
    lessonId: item.lessonId,
    minutes: itemMinutes === undefined ? null : Math.round(itemMinutes),
    requiresPlus: requiresPlus({ access, item }),
    scheduledFor: item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
    skillId: item.skillId,
    status: item.status,
    title: writing ? getWritingTitle({ item, skillAreas }) : item.titleSnapshot,
    writing,
  };
}

/**
 * Only study makes a past day done: its scheduled items finished, or, with nothing scheduled on
 * it, time spent studying. Days before the goal started and past days with nothing scheduled
 * (missed work re-flows to later days) stay neutral, as rest, never done or missed.
 */
function getDayState({
  date,
  items,
  minutes,
  studied,
  today,
}: {
  date: Date;
  items: readonly PlanItemView[];
  /** The day's planned minutes: none on rest days and on days before the goal started. */
  minutes: number;
  studied: boolean;
  today: Date;
}): PlanDayView["state"] {
  if (date.getTime() === today.getTime()) {
    return "today";
  }

  if (items.length === 0 && minutes === 0) {
    return "rest";
  }

  if (date > today) {
    return "upcoming";
  }

  if (items.length === 0) {
    return studied ? "done" : "rest";
  }

  return items.every((item) => item.status !== "todo") ? "done" : "missed";
}

/** This week, Monday to Sunday: each day's minutes, what it focuses on, and the week's checkpoint. */
export function buildWeekView({
  access,
  calendar,
  exam,
  items,
  minutes,
  skillAreas,
  startDate,
  studiedDates,
  targetDate,
  today,
}: {
  access: ItemAccess;
  calendar: StudyCalendar;
  /** The exam's day rules; null for goals that aren't exams. */
  exam: ExamDayRules | null;
  items: readonly ExistingPlanItem[];
  minutes: ReadonlyMap<string, number>;
  skillAreas: SkillAreas;
  /** The learner-local day the goal started; earlier days were never days to study for it. */
  startDate: Date;
  /** This week's days (ISO dates) the learner studied on. */
  studiedDates: ReadonlySet<string>;
  targetDate: Date | null;
  today: Date;
}): PlanView["week"] {
  const start = getStartOfWeek(today);

  const days = Array.from({ length: DAYS_PER_WEEK }, (_, offset) => {
    const date = addDays(start, offset);
    const day = toIsoDate(date);

    const dayItems = items
      .filter((item) => item.scheduledFor && toIsoDate(item.scheduledFor) === day)
      .map((item) => toPlanItemView({ access, item, minutes, skillAreas }));

    const dayMinutes =
      date < startDate ? 0 : getPlannedMinutes({ calendar, date, exam, targetDate });

    return {
      date: day,
      items: dayItems,
      minutes: dayMinutes,
      state: getDayState({
        date,
        items: dayItems,
        minutes: dayMinutes,
        studied: studiedDates.has(day),
        today,
      }),
    };
  });

  return { days, endDate: toIsoDate(getEndOfWeek(today)), startDate: toIsoDate(start) };
}
