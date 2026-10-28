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

async function loadDifficultyBias(goalId: string | null): Promise<DifficultyBias> {
  const plan = goalId
    ? await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } })
    : null;

  return parsePlanSettings(plan?.settings).difficultyBias;
}

/** Uses the session's saved local day, not the request's later date. */
export async function isFreeWeekOver(session: ExtraDay): Promise<boolean> {
  if (!session.goal) {
    return false;
  }

  const access = await loadExamPrepAccess({ goal: session.goal, today: session.localDate });
  return access.trialEnded;
}

/** Null without an askable question; never reuses questions already asked by the session. */
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

const EXTRA_LESSON_WINDOW = 6;

export type ExtraBlocks = [PlannedBlock, ...PlannedBlock[]];

function getLessonsDoneToday(session: ExtraDay): Set<string> {
  return new Set(
    session.blocks.flatMap((block) =>
      block.lessonId && block.status === "completed" ? [block.lessonId] : [],
    ),
  );
}

/** Preserves plan order and permits the last lesson to exceed minutes; no new lessons past the free exam week. */
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

/** Returns a reason when the daily bonus cap or available material prevents adding work. */
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

/** Offer more time only after checking it has actual work to add; expose those lessons before the tap. */
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

/** Keeps the queue locked through checks and append; the callback receives session state read under that lock. */
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

/** Call inside withSessionAppendLock; appends in order and returns the first new block. */
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
