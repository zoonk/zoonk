import "server-only";
import { type ExamBlueprint, type Goal, prisma } from "@zoonk/db";
import { examEditionSchema } from "../../library/exams/blueprint-contract";
import { parsePlanChangePayload } from "../../plans/_utils/plan-change-payload";
import { NOTICE_SOURCE } from "../../plans/plan-change-contract";
import { type NoSitting, type NoticeDay } from "../../plans/plan-view-contract";
import { addDays, fromIsoDate, toIsoDate } from "../../plans/planner/plan-calendar";
import { readOfferedNoticeDay } from "../kept-month";
import { getExamEditionDays, readExamMonth, readExamYear } from "./exam-edition-days";
import { findClosestSittings, findLearnerSitting, groupSittings } from "./exam-sittings";

type NoticeDayBlueprint = Pick<ExamBlueprint, "edition" | "ownerId">;

/**
 * What a goal's notice says about its date: the day it offers, or that its month has none, and
 * the first day of the sitting after the goal's (see `getNextSitting`).
 */
export type NoticeDates = {
  day: NoticeDay | null;
  nextSitting: string | null;
  noSitting: NoSitting | null;
};

const NO_NOTICE_DATES: NoticeDates = { day: null, nextSitting: null, noSitting: null };

function getTomorrow(today: string): string {
  return toIsoDate(addDays(fromIsoDate(today), 1));
}

/** The exam days of the edition the goal prepares for, from its notice (see `getExamEditionDays`). */
function readNoticeDays({
  blueprint,
  details,
  today,
}: {
  blueprint: NoticeDayBlueprint;
  details: unknown;
  today: string;
}) {
  return getExamEditionDays({
    edition: examEditionSchema.safeParse(blueprint.edition).data ?? null,
    examMonth: readExamMonth(details),
    examYear: readExamYear(details),
    from: today,
  });
}

/**
 * The exam day the goal's notice gives, after the learner's today, when it isn't the goal's date:
 * the first day of the sitting the learner means (see `findLearnerSitting`), so an exam held
 * several times a year offers the sitting in their month, or none. The official day, for any goal;
 * the estimated one (`estimated`), only for a goal whose date is the notice's (`noticeDate`), that
 * has none or whose date passed, never over a date the learner set that's still ahead. A day they
 * kept their own date over (`kept`, or the understanding card's offer they didn't take) stays
 * theirs. A class test's day is the learner's or their own material's, never a notice's. The day
 * is only ever offered: Today proposes it, the screens that show the date offer it with one tap,
 * and the goal's date changes only when the learner takes it.
 */
function getNoticeDay({
  blueprint,
  details,
  goalDate,
  kept = [],
  noticeDate,
  today,
}: {
  blueprint: NoticeDayBlueprint | null;
  details: unknown;
  /** The date the plan counts down to, as an ISO date. */
  goalDate: string | null;
  /** The notice's days the learner answered "Keep mine" to (see `loadKeptNoticeDays`). */
  kept?: readonly string[];
  /** The day the plan took from the notice (`PlanSettings.noticeDate`). */
  noticeDate: string | null;
  /** The learner's today, as an ISO date. */
  today: string;
}): NoticeDay | null {
  if (!blueprint || blueprint.ownerId !== null) {
    return null;
  }

  const { days, estimated } = readNoticeDays({ blueprint, details, today });

  // Once the goal's date passed, the learner's own date says nothing about the next sitting.
  const isPassed = goalDate !== null && goalDate < today;
  const isNoticeDated = goalDate === null || goalDate === noticeDate || isPassed;
  const tomorrow = getTomorrow(today);

  const sitting = findLearnerSitting({
    days,
    from: tomorrow,
    goalDate: isPassed ? null : goalDate,
  });

  const next = sitting?.find((day) => day.date >= tomorrow)?.date ?? null;
  const isKept = next !== null && (kept.includes(next) || next === readOfferedNoticeDay(details));

  if (!next || next === goalDate || isKept || (estimated && !isNoticeDated)) {
    return null;
  }

  return { date: next, estimated };
}

/**
 * For an exam held several times a year whose notice has no sitting in the month of the learner's
 * date (DELE B2 in February): that month, with the closest sittings still open for registration
 * (see `findClosestSittings`), so the screens say so and offer them. The learner's date stays
 * theirs until they pick one. Null for a date with a sitting in its month, an exam of one sitting,
 * estimated days, a class test, or a date that passed.
 */
function getNoSitting({
  blueprint,
  details,
  goalDate,
  today,
}: {
  blueprint: NoticeDayBlueprint | null;
  details: unknown;
  /** The date the plan counts down to, as an ISO date. */
  goalDate: string | null;
  /** The learner's today, as an ISO date. */
  today: string;
}): NoSitting | null {
  const tomorrow = getTomorrow(today);

  if (!blueprint || blueprint.ownerId !== null || goalDate === null || goalDate < tomorrow) {
    return null;
  }

  const { days, estimated } = readNoticeDays({ blueprint, details, today });

  if (estimated || findLearnerSitting({ days, from: tomorrow, goalDate })) {
    return null;
  }

  const closest = findClosestSittings({ days, from: tomorrow, goalDate });

  return closest.length > 0
    ? {
        closest: closest.map((day) => day.date),
        month: `${goalDate.slice(0, "YYYY-MM".length)}-01`,
      }
    : null;
}

/**
 * The first day of the exam's sitting after the goal's, from today on, when the notice lists it:
 * a plan that goes on after its exam (`PlanSettings.fullCourse`) has its mocks there for it. None
 * while that edition's days are only estimated, so a screen never gives a guess as its date, and
 * none for a class test or a goal without a date.
 */
function getNextSitting({
  blueprint,
  goalDate,
  today,
}: {
  blueprint: NoticeDayBlueprint | null;
  /** The date the plan counts down to, as an ISO date. */
  goalDate: string | null;
  /** The learner's today, as an ISO date. */
  today: string;
}): string | null {
  if (!blueprint || blueprint.ownerId !== null || goalDate === null) {
    return null;
  }

  const from = [getTomorrow(goalDate), today].toSorted().at(-1) ?? today;

  const { days, estimated } = getExamEditionDays({
    edition: examEditionSchema.safeParse(blueprint.edition).data ?? null,
    examYear: null,
    from,
  });

  // A sitting the goal's date falls in started before `from`: the next one starts after it.
  const next = groupSittings(days).find((sitting) => (sitting[0]?.date ?? "") >= from);

  return estimated ? null : (next?.[0]?.date ?? null);
}

/**
 * The notice's days the learner kept their own date over with "Keep mine" on Today: the screens
 * don't offer them again, until the notice says another day.
 */
async function loadKeptNoticeDays(goalId: string): Promise<string[]> {
  const declined = await prisma.planChange.findMany({
    select: { payload: true },
    where: {
      payload: { equals: NOTICE_SOURCE, path: ["source"] },
      plan: { goalId },
      status: "declined",
    },
  });

  return declined.flatMap((change) =>
    parsePlanChangePayload(change.payload).operations.flatMap((operation) =>
      operation.kind === "setNoticeDate" ? [operation.targetDate] : [],
    ),
  );
}

type NoticeDatesRequest = {
  goal: Pick<Goal, "details" | "examBlueprintId" | "id" | "kind">;
  goalDate: string | null;
  noticeDate: string | null;
  today: string;
};

/**
 * `getNoticeDay` and `getNoSitting` for an exam goal, reading its stored notice and the days the
 * learner kept their date over, so the plan and the exam page say the same; none for other goals.
 */
export async function loadNoticeDates({
  goal,
  goalDate,
  noticeDate,
  today,
}: NoticeDatesRequest): Promise<NoticeDates> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return NO_NOTICE_DATES;
  }

  const [blueprint, kept] = await Promise.all([
    prisma.examBlueprint.findUnique({
      select: { edition: true, ownerId: true },
      where: { id: goal.examBlueprintId },
    }),
    loadKeptNoticeDays(goal.id),
  ]);

  const { details } = goal;

  return {
    day: getNoticeDay({ blueprint, details, goalDate, kept, noticeDate, today }),
    nextSitting: getNextSitting({ blueprint, goalDate, today }),
    noSitting: getNoSitting({ blueprint, details, goalDate, today }),
  };
}

/** The notice's day for an exam goal (see `loadNoticeDates`), so Today offers what the screens do. */
export async function loadNoticeDay(request: NoticeDatesRequest): Promise<NoticeDay | null> {
  const { day } = await loadNoticeDates(request);
  return day;
}
