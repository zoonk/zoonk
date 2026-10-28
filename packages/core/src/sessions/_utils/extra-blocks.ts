import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { isNetScored } from "../../checkpoints/weekly-challenge-rules";
import { loadListeningSkillIds } from "../../exams/listening/listening-skills";
import { loadGoalSkillIds } from "../../learner/_utils/goal-skill-graph";
import { markLearnerChanged, markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import { practicesShortAnswers } from "../../library/exams/short-answers";
import { getGoalField } from "../../library/items/item-field";
import { type DifficultyBias, parsePlanSettings } from "../../plans/planner/plan-state";
import { getBlockItemIds, readBlockPayload, toBlockPayload } from "../block-payload";
import { type ExtraTime, hasExtraPracticeLeft } from "../extra-time";
import { PRACTICE_MINUTES_PER_QUESTION, type PlannedBlock } from "../session-builder";
import { type DayBlockInput } from "./day-block-view";
import { loadExamStructure } from "./exam-structure";
import { loadPlanLessons } from "./load-plan-lessons";
import { loadPracticeItems } from "./load-practice";
import { loadExamPrepAccess } from "./plus-only-lessons";
import { takePracticeQuestions } from "./practice-sets";
import { lockSessionQueue } from "./session-queue-lock";
import { type StudyBlockView, toStudyBlockView } from "./session-view";
import { type StudySessionRow } from "./study-session-access";

type ExtraDay = Pick<StudySessionRow, "goal" | "goalId" | "localDate"> & {
  blocks: readonly DayBlockInput[];
};

/** The plan's "Too easy" or "Too hard" steering, which bonus practice follows too. */
async function loadDifficultyBias(goalId: string | null): Promise<DifficultyBias> {
  const plan = goalId
    ? await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } })
    : null;

  return parsePlanSettings(plan?.settings).difficultyBias;
}

/**
 * A free exam plan past its first week on the session's day: its practice and new lessons come
 * with Plus, so no bonus block adds them.
 */
export async function isFreeWeekOver(session: ExtraDay): Promise<boolean> {
  if (!session.goal) {
    return false;
  }

  const access = await loadExamPrepAccess({ goal: session.goal, today: session.localDate });
  return access.trialEnded;
}

/**
 * Bonus practice on the given skills with questions the session hasn't asked yet, scored like the
 * goal's exam. Its Brain Power is capped like every extra block. Null when none of the skills has
 * a question to practice.
 */
export async function buildExtraPractice({
  areaId = null,
  minutes,
  refresh = false,
  session,
  skillIds,
  title = null,
  userId,
}: {
  areaId?: string | null;
  minutes: number;
  /** Content's "Review" of the goal's fading and due skills. */
  refresh?: boolean;
  session: ExtraDay;
  skillIds: string[];
  title?: string | null;
  userId: string;
}): Promise<PlannedBlock | null> {
  const used = new Set(session.blocks.flatMap((block) => getBlockItemIds(readBlockPayload(block))));

  const [difficultyBias, structure, listeningSkillIds] = await Promise.all([
    loadDifficultyBias(session.goalId),
    session.goal ? loadExamStructure(session.goal) : null,
    session.goalId ? loadListeningSkillIds(session.goalId) : new Set<string>(),
  ]);

  const practice = await loadPracticeItems({
    difficultyBias,
    examBlueprintId: session.goal?.examBlueprintId ?? null,
    excludeItemIds: used,
    field: getGoalField(session.goal?.details),
    listeningSkillIds,
    now: new Date(),
    skillIds,
    typed: session.goal ? practicesShortAnswers({ goal: session.goal, structure }) : false,
    userId,
  });

  const items = takePracticeQuestions({
    practice,
    room: Math.max(1, Math.floor(minutes / PRACTICE_MINUTES_PER_QUESTION)),
  });

  if (items.length === 0) {
    return null;
  }

  return {
    canDo: null,
    estimatedMinutes: Math.max(1, Math.round(items.length * PRACTICE_MINUTES_PER_QUESTION)),
    kind: "practice",
    lessonId: null,
    payload: toBlockPayload({
      areaId,
      extra: true,
      itemIds: items.map((item) => item.itemId),
      netScored: isNetScored(structure),
      refresh,
      skillIds: [...new Set(items.map((item) => item.skillId))],
      title,
    }),
  };
}

/** Plan items the next lessons come from: wide enough for a few lessons past any already done. */
const EXTRA_LESSON_WINDOW = 6;

/** A run of blocks more time adds, never empty. */
export type ExtraBlocks = [PlannedBlock, ...PlannedBlock[]];

/** Lessons finished today: more time never adds them again. */
function getLessonsDoneToday(session: ExtraDay): Set<string> {
  return new Set(
    session.blocks.flatMap((block) =>
      block.lessonId && block.status === "completed" ? [block.lessonId] : [],
    ),
  );
}

/**
 * The plan's next lessons not finished today (a lesson skipped earlier included), in the plan's
 * order: about `minutes` of them (the last one may run past it), or the next one without
 * `minutes`. `planItemIds` narrows them to part of the plan, such as an area. A free exam plan past
 * its first week has none to give: new lessons come with Plus.
 */
export async function buildExtraLessons({
  areaId = null,
  minutes = 0,
  planItemIds,
  session,
}: {
  areaId?: string | null;
  minutes?: number;
  planItemIds?: readonly string[];
  session: ExtraDay;
}): Promise<PlannedBlock[]> {
  if (await isFreeWeekOver(session)) {
    return [];
  }

  const done = getLessonsDoneToday(session);

  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    take: EXTRA_LESSON_WINDOW + done.size,
    where: {
      kind: { in: ["lesson", "chapter"] },
      plan: { goalId: session.goalId ?? "" },
      status: "todo",
      ...(planItemIds && { id: { in: [...planItemIds] } }),
    },
  });

  const lessons = await loadPlanLessons({
    items: items.filter((item) => !item.lessonId || !done.has(item.lessonId)),
  });

  const unique = lessons.filter(
    (lesson, index) =>
      !lesson.lessonId ||
      lessons.findIndex((other) => other.lessonId === lesson.lessonId) === index,
  );

  // Each lesson joins while the ones before it take less than `minutes`; the first always does.
  const fitting = unique.filter(
    (_lesson, index) =>
      index === 0 ||
      unique.slice(0, index).reduce((sum, earlier) => sum + earlier.minutes, 0) < minutes,
  );

  return fitting.map((lesson) => ({
    canDo: lesson.canDo,
    estimatedMinutes: Math.max(1, Math.round(lesson.minutes)),
    kind: "learn",
    lessonId: lesson.lessonId,
    payload: toBlockPayload({
      areaId,
      chapterId: lesson.chapterId,
      extra: true,
      planItemId: lesson.planItemId,
      planSkillId: lesson.planSkillId,
      skillIds: lesson.skillIds,
      title: lesson.title,
    }),
  }));
}

/**
 * What more time would add: the plan's next lessons (about `minutes` of them), else, with every
 * lesson done, mixed practice on the goal's skills while the day has room for it. Why there's
 * nothing otherwise: the day's bonus practice is used up, or nothing is left to practice or learn.
 */
export async function planExtraBlocks({
  minutes,
  session,
  skillIds,
  userId,
}: {
  minutes: number;
  session: ExtraDay;
  skillIds: string[];
  userId: string;
}): Promise<{ blocks: ExtraBlocks } | { reason: "dailyCap" | "nothingToStudy" }> {
  const [lesson, ...lessons] = await buildExtraLessons({ minutes, session });

  if (lesson) {
    return { blocks: [lesson, ...lessons] };
  }

  const blocks = session.blocks.map((block) => ({
    extra: readBlockPayload(block).extra,
    kind: block.kind,
    status: block.status,
  }));

  if (!hasExtraPracticeLeft(blocks)) {
    return { reason: "dailyCap" };
  }

  const practice = await buildExtraPractice({ minutes, session, skillIds, userId });
  return practice ? { blocks: [practice] } : { reason: "nothingToStudy" };
}

/**
 * More time is offered only when it has something to add, so the button never leads to "nothing
 * more to practice", and with the lessons it adds, so the day can list them before the tap. The
 * check reads what the time would hold, only once the rules already allow it.
 */
export async function withExtraStudyCheck({
  extraTime,
  session,
  userId,
}: {
  extraTime: ExtraTime;
  session: ExtraDay;
  userId: string;
}): Promise<ExtraTime> {
  if (!extraTime.available) {
    return extraTime;
  }

  if (await isFreeWeekOver(session)) {
    return { available: false, lessons: [], minutes: 0, reason: "plusRequired" };
  }

  const skillIds = session.goalId ? await loadGoalSkillIds(session.goalId) : [];

  const planned = await planExtraBlocks({ minutes: extraTime.minutes, session, skillIds, userId });

  if ("reason" in planned) {
    return { available: false, lessons: [], minutes: 0, reason: planned.reason };
  }

  const lessons = planned.blocks.flatMap((block) =>
    block.kind === "learn"
      ? [{ minutes: block.estimatedMinutes, title: block.payload.title ?? "" }]
      : [],
  );

  return { ...extraTime, lessons };
}

/**
 * Serializes bonus blocks for one session: the queue stays locked while the caller checks
 * what's there and adds a block, so two taps at once (two areas, or "10 more minutes" twice) see
 * each other's block and never count past the daily cap. The callback gets the session with its
 * blocks read under the lock.
 */
export async function withSessionAppendLock<TResult>({
  plan,
  run,
  session,
}: {
  /** A queue-only edit changes its own plan, never the learner model of their other goals. */
  plan?: { id: string; write: boolean };
  run: (locked: { session: StudySessionRow; transaction: TransactionClient }) => Promise<TResult>;
  session: StudySessionRow;
}): Promise<TResult> {
  return prisma.$transaction(async (transaction) => {
    if (plan?.write) {
      await markPlansChanged(transaction, { planIds: [plan.id] });
    } else {
      await markLearnerChanged(transaction, {
        lockPlanIds: plan ? [plan.id] : [],
        userId: session.userId,
      });
    }

    const locked = await lockSessionQueue({ sessionId: session.id, tx: transaction });

    if (!locked) {
      throw new Error("The study session no longer exists.");
    }

    return run({ session: locked, transaction });
  });
}

/**
 * Adds bonus blocks at the end of the session, in order, and returns the first, where the learner
 * goes on. Call it inside `withSessionAppendLock`.
 */
export async function appendExtraBlocks({
  planned,
  session,
  transaction,
}: {
  planned: ExtraBlocks;
  session: StudySessionRow;
  transaction: TransactionClient;
}): Promise<StudyBlockView> {
  const start = Math.max(-1, ...session.blocks.map((block) => block.position)) + 1;

  const blocks: StudySessionBlock[] = await transaction.studySessionBlock.createManyAndReturn({
    data: planned.map((block, index) => ({
      ...block,
      position: start + index,
      sessionId: session.id,
    })),
  });

  await transaction.studySession.update({ data: { status: "active" }, where: { id: session.id } });

  const first = blocks.find((block) => block.position === start);

  if (!first) {
    throw new Error("The first bonus block wasn't saved.");
  }

  return toStudyBlockView({ answeredItemIds: new Set(), block: first });
}
