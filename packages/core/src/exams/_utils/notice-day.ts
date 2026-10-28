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

export type NoticeDates = {
  day: NoticeDay | null;
  nextSitting: string | null;
  noSitting: NoSitting | null;
};

const NO_NOTICE_DATES: NoticeDates = { day: null, nextSitting: null, noSitting: null };

function getTomorrow(today: string): string {
  return toIsoDate(addDays(fromIsoDate(today), 1));
}

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
  goalDate: string | null;
  kept?: readonly string[];
  noticeDate: string | null;
  today: string;
}): NoticeDay | null {
  if (!blueprint || blueprint.ownerId !== null) {
    return null;
  }

  const { days, estimated } = readNoticeDays({ blueprint, details, today });

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

function getNoSitting({
  blueprint,
  details,
  goalDate,
  today,
}: {
  blueprint: NoticeDayBlueprint | null;
  details: unknown;
  goalDate: string | null;
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

function getNextSitting({
  blueprint,
  goalDate,
  today,
}: {
  blueprint: NoticeDayBlueprint | null;
  goalDate: string | null;
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

  const next = groupSittings(days).find((sitting) => (sitting[0]?.date ?? "") >= from);

  return estimated ? null : (next?.[0]?.date ?? null);
}

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
  blueprint?: NoticeDayBlueprint | null;
  goal: Pick<Goal, "details" | "examBlueprintId" | "id" | "kind">;
  goalDate: string | null;
  noticeDate: string | null;
  today: string;
};

export async function loadNoticeDates({
  blueprint: knownBlueprint,
  goal,
  goalDate,
  noticeDate,
  today,
}: NoticeDatesRequest): Promise<NoticeDates> {
  if (goal.kind !== "exam" || !goal.examBlueprintId) {
    return NO_NOTICE_DATES;
  }

  const [blueprint, kept] = await Promise.all([
    knownBlueprint === undefined
      ? prisma.examBlueprint.findUnique({
          select: { edition: true, ownerId: true },
          where: { id: goal.examBlueprintId },
        })
      : knownBlueprint,
    loadKeptNoticeDays(goal.id),
  ]);

  const { details } = goal;

  return {
    day: getNoticeDay({ blueprint, details, goalDate, kept, noticeDate, today }),
    nextSitting: getNextSitting({ blueprint, goalDate, today }),
    noSitting: getNoSitting({ blueprint, details, goalDate, today }),
  };
}

export async function loadNoticeDay(request: NoticeDatesRequest): Promise<NoticeDay | null> {
  const { day } = await loadNoticeDates(request);
  return day;
}
