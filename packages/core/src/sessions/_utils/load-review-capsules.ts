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

/** Null means never answered. */
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

/** Last-right questions must stay out of review days: repeating them tests recognition rather than recall. */
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

type ReviewHorizon = {
  /** The start of the exam day in the final stretch, else null. */
  examStart: Date | null;
  /** The start of the learner's day, so skills already reviewed today wait for tomorrow. */
  todayStart: Date;
  until: Date;
};

/** Final-stretch reviews may use the exam day as their horizon rather than today's end. */
export function getReviewHorizon({
  finalStretchStart,
  goal,
  localDate,
  timeZone,
}: {
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

/** In the final stretch, review skills due before the exam early; still wait a local day between reviews of the same skill. */
async function loadDueSkills({
  cap,
  horizon,
  skillIds,
  userId,
}: {
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

type PlanLesson = Pick<PlanItem, "skillId" | "status" | "titleSnapshot"> & { lessonId: string };

/** Prefer a finished teaching lesson over a later unstarted lesson that happens to share the skill. */
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

/** Each recording may appear in only one capsule; unheard first, then least recently heard. */
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

/** At most the daily review cap; listening skills require whole voiced recordings and unaskable capsules remain sealed. */
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
  /** Priority confirmations remain within skillIds and the normal daily cap. */
  confirmSkillIds?: readonly string[];
  dailyMinutes: number;
  /** The goal's exam: other exams' questions never come up in a review. */
  examBlueprintId: string | null;
  /** The goal's field: its questions come first, other fields' never. */
  field: string | null;
  horizon: ReviewHorizon;
  /** Listening-only capsules require recordings; text cannot substitute. */
  listeningSkillIds?: ReadonlySet<string>;
  netScoring: boolean;
  /** Prefer completed lessons when naming a capsule. */
  planLessons: readonly PlanLesson[];
  skillIds: readonly string[];
  userId: string;
  /** If nothing is due, select weakest studied skills instead. */
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
