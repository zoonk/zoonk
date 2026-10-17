import "server-only";
import { type Goal, type PlanItem, prisma } from "@zoonk/db";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { isInFinalStretch } from "../../exams/final-stretch/final-stretch-rules";
import { getStartOfLocalDay } from "../../learner/_utils/local-time";
import { getSkillRetrievability } from "../../learner/fsrs-scheduler";
import { getDailyReviewCap, selectDueReviews } from "../../learner/review-load";
import { getItemAudienceFilter } from "../../library/items/item-field";
import { type ItemSetPick, listItemSetsForSkills } from "../../library/items/item-sets";
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

/**
 * The questions the learner answered right the last time they answered them. A review day asks
 * what they haven't seen and brings back only what they missed: one answered right is remembered,
 * so asking it again practices recognizing it, not recalling the idea.
 */
export async function loadRightAnswers({
  itemIds,
  userId,
}: {
  itemIds: readonly string[];
  userId: string;
}): Promise<Set<string>> {
  const lastAnswers = await prisma.attempt.findMany({
    distinct: ["itemId"],
    orderBy: [{ itemId: "asc" }, { answeredAt: "desc" }],
    select: { isCorrect: true, itemId: true },
    where: { itemId: { in: [...itemIds] }, userId },
  });

  return new Set(
    lastAnswers.flatMap((answer) => (answer.isCorrect && answer.itemId ? [answer.itemId] : [])),
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
  cap,
  horizon,
  skillIds,
  userId,
}: {
  /** How many skills the day reviews at most (see `getDailyReviewCap`). */
  cap: number;
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
    cap,
    until: againstExam ? examStart : until,
  }).map((candidate) => candidate.skillId);
}

function isReviewedSince(row: { lastReviewedAt: Date | null }, since: Date): boolean {
  return row.lastReviewedAt !== null && row.lastReviewedAt >= since;
}

/**
 * The studied skills least likely to be recalled by the end of the day, none reviewed today, at
 * most `cap`: what a day with nothing due reviews (see `weakest` in `loadReviewCapsules`).
 */
async function loadWeakestSkills({
  cap,
  horizon,
  skillIds,
  userId,
}: {
  cap: number;
  horizon: ReviewHorizon;
  skillIds: readonly string[];
  userId: string;
}): Promise<string[]> {
  const rows = await prisma.learnerSkill.findMany({
    where: { reps: { gt: 0 }, skillId: { in: [...skillIds] }, userId },
  });

  return rows
    .filter((row) => !isReviewedSince(row, horizon.todayStart))
    .map((row) => ({
      recall: getSkillRetrievability({ memory: row, now: horizon.until }) ?? 0,
      skillId: row.skillId,
    }))
    .toSorted((a, b) => a.recall - b.recall)
    .slice(0, cap)
    .map((row) => row.skillId);
}

/** A lesson of the learner's plan, with the plan skill it's held for. */
type PlanLesson = Pick<PlanItem, "skillId" | "status" | "titleSnapshot"> & { lessonId: string };

/**
 * The lesson that taught each skill is its capsule: one the learner finished, else one in their
 * plan, else the first lesson that teaches it. Carla's review was named after a later module's
 * lesson she hadn't started, which taught the skill of the one she had. A plan skill whose lessons
 * teach finer skills of their own is taught by the lessons the plan holds for it.
 */
async function loadCapsuleSources({
  planLessons,
  skillIds,
}: {
  planLessons: readonly PlanLesson[];
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

  const planLessonIds = new Set(planLessons.map((lesson) => lesson.lessonId));

  const studiedLessonIds = new Set(
    planLessons.flatMap((lesson) => (lesson.status === "done" ? [lesson.lessonId] : [])),
  );

  return skillIds.map((skillId) => {
    const taught = [
      ...lessonSkills
        .filter((row) => row.skillId === skillId)
        .map((row) => ({ lessonId: row.lessonId, title: row.lesson.title })),
      ...planLessons
        .filter((lesson) => lesson.skillId === skillId)
        .map((lesson) => ({ lessonId: lesson.lessonId, title: lesson.titleSnapshot })),
    ];

    const name = skills.find((skill) => skill.id === skillId)?.name ?? "";

    const source =
      taught.find((row) => studiedLessonIds.has(row.lessonId)) ??
      taught.find((row) => planLessonIds.has(row.lessonId)) ??
      taught[0];

    return { lessonId: source?.lessonId ?? null, skillId, title: source?.title ?? name };
  });
}

/**
 * The voiced recording each capsule plays for its listening skills (see `loadReviewCapsules`): the
 * one heard longest ago (never heard first) on one of them, each recording in one capsule only.
 */
function pickCapsuleRecordings({
  groups,
  listeningSkillIds,
  recordings,
}: {
  groups: readonly { skillIds: readonly string[] }[];
  listeningSkillIds: ReadonlySet<string>;
  recordings: readonly ItemSetPick[];
}): (ItemSetPick | null)[] {
  return groups.reduce<(ItemSetPick | null)[]>((picked, group) => {
    const recording = recordings.find(
      (set) =>
        !picked.includes(set) &&
        set.skillIds.some(
          (skillId) => listeningSkillIds.has(skillId) && group.skillIds.includes(skillId),
        ),
    );

    picked.push(recording ?? null);
    return picked;
  }, []);
}

/**
 * Today's capsules for a goal: the skills FSRS says are due by the end of the learner's day (by
 * the exam in its final stretch), under the daily cap and most at risk first, grouped by the lesson that taught them, each with a
 * format and a few quick questions. Known topics to confirm (`confirmSkillIds`) come first,
 * within the same cap. A skill only recordings practice comes back with one whole voiced
 * recording on it, never a text question. A capsule with no question to ask stays sealed until the
 * item bank has one.
 */
export async function loadReviewCapsules({
  confirmSkillIds = [],
  dailyMinutes,
  examBlueprintId,
  field,
  horizon,
  listeningSkillIds = new Set(),
  netScoring,
  planLessons,
  skillIds,
  userId,
  weakest = false,
}: {
  /**
   * Known topics the review asks first, in place of practice (see `loadReviewsAndClaims`): only
   * the ones it can ask (`skillIds`) count, within the daily cap.
   */
  confirmSkillIds?: readonly string[];
  dailyMinutes: number;
  /** The goal's exam: other exams' questions never come up in a review. */
  examBlueprintId: string | null;
  /** The goal's field: its questions come first, other fields' never. */
  field: string | null;
  horizon: ReviewHorizon;
  /**
   * Skills only recordings practice (`getListeningSkillIds`): a text question about a conversation
   * tests reading, so their capsule plays a recording or stays sealed.
   */
  listeningSkillIds?: ReadonlySet<string>;
  netScoring: boolean;
  /** The plan's lessons: what a capsule is named after, the ones the learner finished first. */
  planLessons: readonly PlanLesson[];
  skillIds: readonly string[];
  userId: string;
  /** Nothing is due: the capsules review the weakest studied skills instead (`loadWeakestSkills`). */
  weakest?: boolean;
}): Promise<BlockCapsule[]> {
  const cap = getDailyReviewCap({ dailyMinutes });
  const confirm = confirmSkillIds.filter((skillId) => skillIds.includes(skillId)).slice(0, cap);
  const others = skillIds.filter((skillId) => !confirm.includes(skillId));

  const dueSkillIds = weakest
    ? await loadWeakestSkills({ cap, horizon, skillIds, userId })
    : [
        ...confirm,
        ...(await loadDueSkills({ cap: cap - confirm.length, horizon, skillIds: others, userId })),
      ];

  if (dueSkillIds.length === 0) {
    return [];
  }

  const dueListeningIds = dueSkillIds.filter((skillId) => listeningSkillIds.has(skillId));

  const [sources, items, sets] = await Promise.all([
    loadCapsuleSources({ planLessons, skillIds: dueSkillIds }),
    prisma.item.findMany({
      orderBy: { id: "asc" },
      select: { field: true, format: true, id: true, skillId: true },
      where: {
        format: { in: [...SESSION_ITEM_FORMATS] },
        skillId: { in: dueSkillIds.filter((skillId) => !listeningSkillIds.has(skillId)) },
        ...getItemAudienceFilter({ examBlueprintId, field }),
      },
    }),
    dueListeningIds.length > 0
      ? listItemSetsForSkills({ examBlueprintId, skillIds: dueListeningIds, userId })
      : [],
  ]);

  const lastAnswers = await loadLastAnswers({ itemIds: items.map((item) => item.id), userId });

  const candidates: CapsuleItemCandidate[] = items.map((item) => ({
    format: item.format,
    id: item.id,
    inField: field !== null && item.field === field,
    lastAnsweredAt: lastAnswers.get(item.id) ?? null,
    skillId: item.skillId,
  }));

  const groups = groupIntoCapsules(sources);

  const recordings = pickCapsuleRecordings({
    groups,
    listeningSkillIds,
    recordings: sets.filter((set) => set.kind === "audio"),
  });

  return groups
    .map((group, index) => {
      const own = candidates.filter((item) => group.skillIds.includes(item.skillId));
      const format = pickCapsuleFormat({ formats: own.map((item) => item.format), netScoring });

      return {
        ...group,
        format,
        itemIds: [
          ...(recordings[index]?.items.map((item) => item.id) ?? []),
          ...pickCapsuleItems({ candidates: own, format, skillIds: group.skillIds }),
        ],
      };
    })
    .filter((capsule) => capsule.itemIds.length > 0);
}
