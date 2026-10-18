import { type PlanDayView, type PlanItemView, type PlanView } from "../plan-view-contract";
import { type MockFunding, findMockFundingOn, getMockFundingStart } from "../planner/mock-funding";
import {
  type StudyCalendar,
  addDays,
  getEndOfWeek,
  getStartOfWeek,
  toIsoDate,
} from "../planner/plan-calendar";
import { type ExamDayRules, getPlannedMinutes } from "../planner/plan-days";
import { getItemKey } from "../planner/plan-items";
import { DAYS_PER_WEEK, type PlanSettings } from "../planner/plan-state";
import { type SkillAreas, getWritingTitle, isWritingItem } from "./plan-phase-views";
import { type PlanReadItem } from "./plan-read-projection";
import { isWorkFinished } from "./work-progress";

type ItemAccess = { freeUntil: string | null; mocksRequirePlus: boolean };

/** Free exam plans stop at their first week, and mock exams need Plus. */
function requiresPlus({ access, item }: { access: ItemAccess; item: PlanReadItem }): boolean {
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
  item: PlanReadItem;
  minutes: ReadonlyMap<string, number>;
  skillAreas: SkillAreas;
}): PlanItemView {
  const itemMinutes = item.minutes ?? minutes.get(item.key ?? getItemKey(item));
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
 * Only study makes a past day done: its scheduled items finished (`isWorkFinished`: studied or
 * tested out, never set aside after missed days), or, with nothing scheduled on it, time spent
 * studying. Days before the goal started and past days with nothing scheduled (missed work
 * re-flows to later days) stay neutral, as rest, never done or missed.
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

  return items.every((item) => isWorkFinished(item.status)) ? "done" : "missed";
}

/** This week, Monday to Sunday: each day's minutes, what it focuses on, and the week's checkpoint. */
export function buildWeekView({
  access,
  calendar,
  exam,
  items,
  minutes,
  overflow = [],
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
  items: readonly PlanReadItem[];
  minutes: ReadonlyMap<string, number>;
  /** The time the days' checkpoints take past them (`PlanSettings.checkpointOverflow`). */
  overflow?: PlanSettings["checkpointOverflow"];
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
      date < startDate ? 0 : getPlannedMinutes({ calendar, date, exam, overflow, targetDate });

    return {
      date: day,
      items: dayItems,
      minutes: dayMinutes,
      mockFunding:
        date < startDate ? null : findMockFundingOn({ date, funding: exam?.mockFunding ?? [] }),
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

/** Announce funded events by their persisted IDs, never by a speculative planner preview. */
export function buildFundedMocksView({
  access,
  funding,
  items,
  skillAreas,
  today,
}: {
  access: ItemAccess;
  funding: readonly MockFunding[];
  items: readonly PlanReadItem[];
  skillAreas: SkillAreas;
  today: Date;
}): (PlanItemView & { id: string })[] {
  const day = toIsoDate(today);

  return items
    .flatMap((item) => {
      if (!item.id || item.kind !== "mock" || item.status !== "todo" || !item.scheduledFor) {
        return [];
      }

      const date = toIsoDate(item.scheduledFor);
      const ledger = funding.find((entry) => entry.date === date);

      if (date <= day || !ledger || getMockFundingStart(ledger) > day) {
        return [];
      }

      return [
        {
          ...toPlanItemView({ access, item, minutes: new Map(), skillAreas }),
          id: item.id,
          minutes: ledger.minutes,
        },
      ];
    })
    .toSorted((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));
}
