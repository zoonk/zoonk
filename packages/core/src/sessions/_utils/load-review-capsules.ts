import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { isInFinalStretch } from "../../exams/final-stretch/final-stretch-rules";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { getDailyReviewCap, selectDueReviews } from "../../learner/review-load";
import { getItemAudienceFilter } from "../../library/items/item-field";
import { type BlockCapsule } from "../block-payload";
import {
  type CapsuleItemCandidate,
  type DueSkill,
  groupIntoCapsules,
  pickCapsuleFormat,
  pickCapsuleItems,
} from "../capsules";
import { SESSION_ITEM_FORMATS } from "./session-items";

/** When each question was last answered by the learner, or null when never. */
export async function loadLastAnswers({
  itemIds,
  userId,
}: {
  itemIds: readonly string[];
  userId: string;
}): Promise<Map<string, Date>> {
  const rows = await prisma.attempt.groupBy({
    _max: { answeredAt: true },
    by: ["itemId"],
    where: { itemId: { in: [...itemIds] }, userId },
  });

  return new Map(
    rows.flatMap((row) =>
      row.itemId && row._max.answeredAt ? [[row.itemId, row._max.answeredAt]] : [],
    ),
  );
}

/** The review window: the end of the learner's day, or the exam's start in its final stretch. */
type ReviewHorizon = {
  /** The start of the exam day in the final stretch, else null. */
  examStart: Date | null;
  /** The start of the learner's day, so skills already reviewed today wait for tomorrow. */
  todayStart: Date;
  until: Date;
};

/** Today's review window for a goal, reaching to the exam day in an exam's final stretch. */
export function getReviewHorizon({
  finalStretchStart,
  goal,
  localDate,
  timeZone,
}: {
  /** See `getFinalStretchStart`. */
  finalStretchStart: Date | null;
  goal: Pick<Goal, "kind" | "targetDate">;
  /** The learner-local date, as a UTC-midnight label. */
  localDate: Date;
  timeZone: string;
}): ReviewHorizon {
  const inFinalStretch =
    goal.kind === "exam" &&
    isInFinalStretch({ finalStretchStart, targetDate: goal.targetDate, today: localDate });

  return {
    examStart:
      inFinalStretch && goal.targetDate
        ? getStartOfLocalDay({ localDate: goal.targetDate, timeZone })
        : null,
    todayStart: getStartOfLocalDay({ localDate, timeZone }),
    until: getStartOfLocalDay({ localDate: new Date(localDate.getTime() + MS_PER_DAY), timeZone }),
  };
}

/**
 * Reviews run against the exam date: in the final stretch, a skill whose next review would come
 * before the exam is due already, so every skill fading below target by exam day gets one more
 * review first, most at risk on exam day first and under the same daily cap. Each one waits a day
 * after its last review, so the same skill doesn't come back twice in one day.
 */
async function loadDueSkills({
  dailyMinutes,
  horizon,
  skillIds,
  userId,
}: {
  dailyMinutes: number;
  horizon: ReviewHorizon;
  skillIds: readonly string[];
  userId: string;
}) {
  const { examStart, todayStart, until } = horizon;
  const againstExam = examStart !== null && examStart > until;

  const rows = await prisma.learnerSkill.findMany({
    where: { due: { not: null }, reps: { gt: 0 }, skillId: { in: [...skillIds] }, userId },
  });

  const candidates = rows.filter(
    (row) =>
      !againstExam || (row.due !== null && row.due < until) || !isReviewedSince(row, todayStart),
  );

  return selectDueReviews({
    candidates: candidates.map((row) => ({ memory: row, skillId: row.skillId })),
    cap: getDailyReviewCap({ dailyMinutes }),
    until: againstExam ? examStart : until,
  }).map((candidate) => candidate.skillId);
}

function isReviewedSince(row: { lastReviewedAt: Date | null }, since: Date): boolean {
  return row.lastReviewedAt !== null && row.lastReviewedAt >= since;
}

/**
 * The lesson that taught each skill is its capsule: the one in the learner's plan when there is
 * one, otherwise the first lesson that teaches it.
 */
async function loadCapsuleSources({
  planLessonIds,
  skillIds,
}: {
  planLessonIds: ReadonlySet<string>;
  skillIds: readonly string[];
}): Promise<DueSkill[]> {
  const [skills, lessonSkills] = await Promise.all([
    prisma.skill.findMany({
      select: { id: true, name: true },
      where: { id: { in: [...skillIds] } },
    }),
    prisma.lessonSkill.findMany({
      include: { lesson: { select: { id: true, title: true } } },
      orderBy: { createdAt: "asc" },
      where: { skillId: { in: [...skillIds] } },
    }),
  ]);

  return skillIds.map((skillId) => {
    const taught = lessonSkills.filter((row) => row.skillId === skillId);
    const source = taught.find((row) => planLessonIds.has(row.lessonId)) ?? taught[0];
    const name = skills.find((skill) => skill.id === skillId)?.name ?? "";

    return { lessonId: source?.lessonId ?? null, skillId, title: source?.lesson.title ?? name };
  });
}

/**
 * Today's capsules for a goal: the skills FSRS says are due by the end of the learner's day (by
 * the exam in its final stretch), under the daily cap and most at risk first, grouped by the lesson that taught them, each with a
 * format and a few quick questions. A capsule with no question to ask stays sealed until the
 * item bank has one.
 */
export async function loadReviewCapsules({
  dailyMinutes,
  examBlueprintId,
  field,
  horizon,
  netScoring,
  planLessonIds,
  skillIds,
  userId,
}: {
  dailyMinutes: number;
  /** The goal's exam: other exams' questions never come up in a review. */
  examBlueprintId: string | null;
  /** The goal's field: its questions come first, other fields' never. */
  field: string | null;
  horizon: ReviewHorizon;
  netScoring: boolean;
  planLessonIds: ReadonlySet<string>;
  skillIds: readonly string[];
  userId: string;
}): Promise<BlockCapsule[]> {
  const dueSkillIds = await loadDueSkills({ dailyMinutes, horizon, skillIds, userId });

  if (dueSkillIds.length === 0) {
    return [];
  }

  const [sources, items] = await Promise.all([
    loadCapsuleSources({ planLessonIds, skillIds: dueSkillIds }),
    prisma.item.findMany({
      orderBy: { id: "asc" },
      select: { field: true, format: true, id: true, skillId: true },
      where: {
        format: { in: [...SESSION_ITEM_FORMATS] },
        skillId: { in: dueSkillIds },
        ...getItemAudienceFilter({ examBlueprintId, field }),
      },
    }),
  ]);

  const lastAnswers = await loadLastAnswers({ itemIds: items.map((item) => item.id), userId });

  const candidates: CapsuleItemCandidate[] = items.map((item) => ({
    format: item.format,
    id: item.id,
    inField: field !== null && item.field === field,
    lastAnsweredAt: lastAnswers.get(item.id) ?? null,
    skillId: item.skillId,
  }));

  return groupIntoCapsules(sources)
    .map((group) => {
      const own = candidates.filter((item) => group.skillIds.includes(item.skillId));
      const format = pickCapsuleFormat({ formats: own.map((item) => item.format), netScoring });

      return {
        ...group,
        format,
        itemIds: pickCapsuleItems({ candidates: own, format, skillIds: group.skillIds }),
      };
    })
    .filter((capsule) => capsule.itemIds.length > 0);
}
