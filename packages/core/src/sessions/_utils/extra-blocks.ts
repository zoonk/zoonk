import "server-only";
import { isDeepStrictEqual } from "node:util";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { isNetScored } from "../../checkpoints/weekly-challenge-rules";
import { loadListeningSkillIds } from "../../exams/listening/listening-skills";
import { loadGoalSkillIds } from "../../learner/_utils/goal-skill-graph";
import { markLearnerChanged, markPlansChanged } from "../../learner/_utils/mark-learner-changed";
import { getGoalField } from "../../library/items/item-field";
import { type DifficultyBias, parsePlanSettings } from "../../plans/planner/plan-state";
import { getBlockItemIds, readBlockPayload, toBlockPayload } from "../block-payload";
import { type ExtraTime } from "../extra-time";
import { PRACTICE_MINUTES_PER_QUESTION, type PlannedBlock } from "../session-builder";
import { type DayBlockInput } from "./day-block-view";
import { loadExamStructure } from "./exam-structure";
import { loadPlanLessons } from "./load-plan-lessons";
import { loadPracticeItems } from "./load-practice";
import { loadExamPrepAccess } from "./plus-only-lessons";
import { takePracticeQuestions } from "./practice-sets";
import { lockSessionQueue } from "./session-queue-lock";
import { type StudyBlockView, toStudyBlockView } from "./session-view";
import { STUDY_SESSION_INCLUDE, type StudySessionRow } from "./study-session-access";

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

/**
 * Without questions to practice, the bonus time goes to the plan's next lesson not finished today,
 * a lesson skipped earlier included. `planItemIds` narrows it to part of the plan, such as an area.
 * A free exam plan past its first week has none to give: new lessons come with Plus.
 */
export async function buildExtraLesson({
  areaId = null,
  planItemIds,
  session,
  userId,
}: {
  areaId?: string | null;
  planItemIds?: readonly string[];
  session: ExtraDay;
  userId: string;
}): Promise<PlannedBlock | null> {
  if (await isFreeWeekOver(session)) {
    return null;
  }

  const done = new Set(
    session.blocks.flatMap((block) =>
      block.lessonId && block.status === "completed" ? [block.lessonId] : [],
    ),
  );

  const items = await prisma.planItem.findMany({
    orderBy: { position: "asc" },
    where: {
      kind: { in: ["lesson", "chapter"] },
      plan: { goalId: session.goalId ?? "" },
      status: "todo",
      ...(planItemIds && { id: { in: [...planItemIds] } }),
    },
  });

  const lessons = await loadPlanLessons({
    items: items.filter((item) => !item.lessonId || !done.has(item.lessonId)).slice(0, 1),
    userId,
  });

  const next = lessons[0];

  if (!next) {
    return null;
  }

  return {
    canDo: next.canDo,
    estimatedMinutes: Math.max(1, Math.round(next.minutes)),
    kind: "learn",
    lessonId: next.lessonId,
    payload: toBlockPayload({
      areaId,
      chapterId: next.chapterId,
      extra: true,
      planItemId: next.planItemId,
      planSkillId: next.planSkillId,
      skillIds: next.skillIds,
      title: next.title,
    }),
  };
}

/**
 * The bonus block "10 more minutes" would add: mixed practice on the goal's skills, else the plan's
 * next lesson. Null when nothing is left to practice or learn.
 */
export async function planExtraBlock({
  minutes,
  session,
  skillIds,
  userId,
}: {
  minutes: number;
  session: ExtraDay;
  skillIds: string[];
  userId: string;
}): Promise<PlannedBlock | null> {
  return (
    (await buildExtraPractice({ minutes, session, skillIds, userId })) ??
    (await buildExtraLesson({ session, userId }))
  );
}

/**
 * "10 more minutes" is offered only when it has something to add, so the button never leads to
 * "nothing more to practice". The check reads what the bonus block would hold, only once the rules
 * already allow it.
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
    return { available: false, minutes: 0, reason: "plusRequired" };
  }

  const skillIds = session.goalId ? await loadGoalSkillIds(session.goalId) : [];

  const planned = await planExtraBlock({ minutes: extraTime.minutes, session, skillIds, userId });

  return planned ? extraTime : { available: false, minutes: 0, reason: "nothingToStudy" };
}

/**
 * Serializes bonus blocks for one session: the queue stays locked while the caller checks
 * what's there and adds a block, so two taps at once (two areas, or "10 more minutes" twice) see
 * each other's block and never count past the daily cap. The callback gets the session with its
 * blocks read under the lock.
 */
export async function withSessionAppendLock<TResult>({
  planId,
  run,
  session,
}: {
  /** A queue-only edit changes its own plan, never the learner model of their other goals. */
  planId?: string;
  run: (locked: { session: StudySessionRow; transaction: TransactionClient }) => Promise<TResult>;
  session: StudySessionRow;
}): Promise<TResult> {
  class QueueUnchangedError extends Error {
    override name = "QueueUnchangedError";
  }

  const unchanged: { value: { result: TResult } | null } = { value: null };

  try {
    return await prisma.$transaction(async (transaction) => {
      if (planId) {
        await markPlansChanged(transaction, { planIds: [planId] });
      } else {
        await markLearnerChanged(transaction, { userId: session.userId });
      }

      const locked = await lockSessionQueue({ sessionId: session.id, tx: transaction });

      if (!locked) {
        throw new Error("The study session no longer exists.");
      }

      const result = await run({ session: locked, transaction });

      const current = await transaction.studySession.findUnique({
        include: STUDY_SESSION_INCLUDE,
        where: { id: session.id },
      });

      if (isDeepStrictEqual(locked, current)) {
        unchanged.value = { result };
        throw new QueueUnchangedError();
      }

      return result;
    });
  } catch (error) {
    if (error instanceof QueueUnchangedError && unchanged.value) {
      return unchanged.value.result;
    }

    throw error;
  }
}

/** Adds a bonus block at the end of the session. Call it inside `withSessionAppendLock`. */
export async function appendExtraBlock({
  planned,
  session,
  transaction,
}: {
  planned: PlannedBlock;
  session: StudySessionRow;
  transaction: TransactionClient;
}): Promise<StudyBlockView> {
  const position = Math.max(-1, ...session.blocks.map((block) => block.position)) + 1;

  const block: StudySessionBlock = await transaction.studySessionBlock.create({
    data: { ...planned, position, sessionId: session.id },
  });

  await transaction.studySession.update({ data: { status: "active" }, where: { id: session.id } });

  return toStudyBlockView({ answeredItemIds: new Set(), block });
}
