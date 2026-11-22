import { type WeekDay } from "../../sessions/daily-goal";
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
import { LEARN_KINDS, isWritingItem } from "../planner/plan-item-rules";
import { DAYS_PER_WEEK, type PlanSettings } from "../planner/plan-state";
import { projectItemOnDay } from "./item-day";
import { type SkillAreas, getWritingTitle } from "./plan-phase-views";
import { type PlanReadItem } from "./plan-read-projection";
import { readSelectedItemFacts } from "./selected-item-contract";

/**
 * A written lesson is one; lessons still to be written count the day's share of their size, rounded
 * through the days before it so a topic's days add up to its lessons.
 */
function countDayLessons({
  date,
  item,
  onDay,
}: {
  date: Date;
  item: PlanReadItem;
  onDay: PlanReadItem;
}): number {
  if (!LEARN_KINDS.has(item.kind)) {
    return 0;
  }

  if (item.lessonId !== null || !item.minutes || !onDay.minutes) {
    return 1;
  }

  const day = toIsoDate(date);
  const lessons = Math.max(1, item.lessons ?? 1);
  const days = readSelectedItemFacts(item.facts)?.days ?? [];

  // A kept item's minutes can be fewer than the days it was saved with still hold.
  const total = Math.max(
    item.minutes,
    days.reduce((sum, [, minutes]) => sum + minutes, 0),
  );

  const before = days.reduce(
    (sum, [allocated, minutes]) => (allocated < day ? sum + minutes : sum),
    0,
  );

  const through = (minutes: number) => Math.round((lessons * minutes) / total);

  return through(before + onDay.minutes) - through(before);
}

function toPlanItemView({
  access,
  item,
  lessons,
  skillAreas,
}: {
  access: Pick<PlanView["access"], "mocksRequirePlus">;
  item: PlanReadItem;
  lessons: number;
  skillAreas: SkillAreas;
}): PlanItemView {
  const itemMinutes = item.minutes;
  const writing = isWritingItem(item);

  return {
    chapterId: item.chapterId,
    id: item.id,
    kind: item.kind,
    lessonId: item.lessonId,
    lessons,
    minutes: itemMinutes === null || itemMinutes === undefined ? null : Math.round(itemMinutes),
    requiresPlus: item.kind === "mock" && access.mocksRequirePlus,
    scheduledFor: item.scheduledFor ? toIsoDate(item.scheduledFor) : null,
    skillId: item.skillId,
    status: item.status,
    title: writing ? getWritingTitle({ item, skillAreas }) : item.titleSnapshot,
    writing,
  };
}

function getDayState({ study, today }: { study: WeekDay; today: Date }): PlanDayView["state"] {
  if (study.isToday) {
    return "today";
  }

  if (study.hitGoal) {
    return "done";
  }

  if (study.kind !== "study" && study.total === 0) {
    return "rest";
  }

  return study.date > today ? "upcoming" : "missed";
}

type DaysInput = {
  access: Pick<PlanView["access"], "mocksRequirePlus">;
  calendar: StudyCalendar;
  exam: ExamDayRules | null;
  items: readonly PlanReadItem[];
  overflow?: PlanSettings["checkpointOverflow"];
  skillAreas: SkillAreas;
  startDate: Date;
  studyDays: readonly WeekDay[];
  timeZone: string;
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
  studyDays,
  timeZone,
  targetDate,
  today,
}: DaysInput & { from: Date }): PlanDayView[] {
  return Array.from({ length: DAYS_PER_WEEK }, (_, offset) => {
    const date = addDays(from, offset);
    const day = toIsoDate(date);

    const dayItems = items.flatMap((item) => {
      const onDay = projectItemOnDay({ date, item, timeZone });

      return onDay
        ? [
            toPlanItemView({
              access,
              item: onDay,
              lessons: countDayLessons({ date, item, onDay }),
              skillAreas,
            }),
          ]
        : [];
    });

    const dayMinutes =
      date < startDate ? 0 : getPlannedMinutes({ calendar, date, exam, overflow, targetDate });

    const study = studyDays.find((entry) => entry.date.getTime() === date.getTime());

    if (!study) {
      throw new Error("Missing study week day");
    }

    return {
      date: day,
      items: dayItems,
      minutes: dayMinutes,
      mockFunding:
        date < startDate ? null : findMockFundingOn({ date, funding: exam?.mockFunding ?? [] }),
      state: getDayState({ study, today }),
      study: { ...study, date: day },
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

export function buildFundedMocksView({
  access,
  funding,
  items,
  skillAreas,
  today,
}: {
  access: Pick<PlanView["access"], "mocksRequirePlus">;
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
          ...toPlanItemView({ access, item, lessons: 0, skillAreas }),
          id: item.id,
          minutes: ledger.minutes,
        },
      ];
    })
    .toSorted((a, b) => (a.scheduledFor ?? "").localeCompare(b.scheduledFor ?? ""));
}
