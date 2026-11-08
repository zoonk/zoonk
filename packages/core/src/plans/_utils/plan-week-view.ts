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
import { isWritingItem } from "../planner/plan-item-rules";
import { DAYS_PER_WEEK, type PlanSettings } from "../planner/plan-state";
import { type SkillAreas, getWritingTitle } from "./plan-phase-views";
import { type PlanReadItem } from "./plan-read-projection";
import { projectSavedAllocationOn } from "./saved-allocation";
import { isWorkFinished } from "./work-progress";

type ItemAccess = { freeUntil: string | null; mocksRequirePlus: boolean };

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
  skillAreas,
}: {
  access: ItemAccess;
  item: PlanReadItem;
  skillAreas: SkillAreas;
}): PlanItemView {
  const itemMinutes = item.minutes;
  const writing = isWritingItem(item);

  return {
    chapterId: item.chapterId,
    id: item.id,
    kind: item.kind,
    lessonId: item.lessonId,
    minutes: itemMinutes === null || itemMinutes === undefined ? null : Math.round(itemMinutes),
    requiresPlus: requiresPlus({ access, item }),
    scheduledFor: item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
    skillId: item.skillId,
    status: item.status,
    title: writing ? getWritingTitle({ item, skillAreas }) : item.titleSnapshot,
    writing,
  };
}

function getDayState({
  date,
  items,
  minutes,
  studied,
  today,
}: {
  date: Date;
  items: readonly PlanItemView[];
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

type DaysInput = {
  access: ItemAccess;
  calendar: StudyCalendar;
  exam: ExamDayRules | null;
  items: readonly PlanReadItem[];
  overflow?: PlanSettings["checkpointOverflow"];
  skillAreas: SkillAreas;
  startDate: Date;
  studiedDates: ReadonlySet<string>;
  targetDate: Date | null;
  today: Date;
};

/** Seven days from `from`. */
function buildPlanDays({
  access,
  calendar,
  exam,
  from,
  items,
  overflow = [],
  skillAreas,
  startDate,
  studiedDates,
  targetDate,
  today,
}: DaysInput & { from: Date }): PlanDayView[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, offset) => {
    const date = addDays(from, offset);
    const day = toIsoDate(date);

    const dayItems = items
      .flatMap((item) => projectSavedAllocationOn({ date, item }) ?? [])
      .map((item) => toPlanItemView({ access, item, skillAreas }));

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
}

export function buildWeekView(input: DaysInput): PlanView["week"] {
  const start = getStartOfWeek(input.today);

  return {
    days: buildPlanDays({ ...input, from: start }),
    endDate: toIsoDate(getEndOfWeek(input.today)),
    startDate: toIsoDate(start),
  };
}

/** Today and the six days after it, whatever the weekday: a week from Monday read on a Sunday holds one day ahead. */
export function buildNextDaysView(input: DaysInput): PlanDayView[] {
  return buildPlanDays({ ...input, from: input.today });
}

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
        { ...toPlanItemView({ access, item, skillAreas }), id: item.id, minutes: ledger.minutes },
      ];
    })
    .toSorted((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));
}
