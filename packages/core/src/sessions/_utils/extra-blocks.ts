import "server-only";
import { type StudySessionBlock, type TransactionClient, prisma } from "@zoonk/db";
import { isNetScored } from "../../checkpoints/weekly-challenge-rules";
import { getGoalField } from "../../library/items/item-field";
import { type DifficultyBias, parsePlanSettings } from "../../plans/planner/plan-state";
import { getBlockItemIds, readBlockPayload, toBlockPayload } from "../block-payload";
import { PRACTICE_MINUTES_PER_QUESTION, type PlannedBlock } from "../session-builder";
import { loadExamStructure } from "./load-build-inputs";
import { loadPlanLessons } from "./load-plan-lessons";
import { loadPracticeItems } from "./load-practice";
import { type StudyBlockView, toStudyBlockView } from "./session-view";
import { type StudySessionRow } from "./study-session-access";

/** The plan's "Too easy" or "Too hard" steering, which bonus practice follows too. */
async function loadDifficultyBias(goalId: string | null): Promise<DifficultyBias> {
  const plan = goalId
    ? await prisma.plan.findUnique({ select: { settings: true }, where: { goalId } })
    : null;

  return parsePlanSettings(plan?.settings).difficultyBias;
}

/**
 * Bonus practice on the given skills with questions the session hasn't asked yet, scored like the
 * goal's exam. Its Brain Power is capped like every extra block. Null when none of the skills has
 * a question to practice.
 */
export async function buildExtraPractice({
  areaId = null,
  minutes,
  session,
  skillIds,
  title = null,
  userId,
}: {
  areaId?: string | null;
  minutes: number;
  session: StudySessionRow;
  skillIds: string[];
  title?: string | null;
  userId: string;
}): Promise<PlannedBlock | null> {
  const used = new Set(session.blocks.flatMap((block) => getBlockItemIds(readBlockPayload(block))));

  const [difficultyBias, structure] = await Promise.all([
    loadDifficultyBias(session.goalId),
    session.goal ? loadExamStructure(session.goal) : null,
  ]);

  const practice = await loadPracticeItems({
    difficultyBias,
    examBlueprintId: session.goal?.examBlueprintId ?? null,
    excludeItemIds: used,
    field: getGoalField(session.goal?.details),
    now: new Date(),
    skillIds,
    userId,
  });

  const items = practice.slice(0, Math.max(1, Math.floor(minutes / PRACTICE_MINUTES_PER_QUESTION)));

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
      skillIds: [...new Set(items.map((item) => item.skillId))],
      title,
    }),
  };
}

/**
 * Without questions to practice, the bonus time goes to the plan's next lesson not finished today,
 * a lesson skipped earlier included. `planItemIds` narrows it to part of the plan, such as an area.
 */
export async function buildExtraLesson({
  areaId = null,
  planItemIds,
  session,
  userId,
}: {
  areaId?: string | null;
  planItemIds?: readonly string[];
  session: StudySessionRow;
  userId: string;
}): Promise<PlannedBlock | null> {
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
      skillIds: next.skillIds,
      title: next.title,
    }),
  };
}

/**
 * Serializes bonus blocks for one session: the session row stays locked while the caller checks
 * what's there and adds a block, so two taps at once (two areas, or "10 more minutes" twice) see
 * each other's block and never count past the daily cap. The callback gets the session with its
 * blocks read under the lock.
 */
export async function withSessionAppendLock<TResult>({
  run,
  session,
}: {
  run: (locked: { session: StudySessionRow; transaction: TransactionClient }) => Promise<TResult>;
  session: StudySessionRow;
}): Promise<TResult> {
  return prisma.$transaction(async (transaction) => {
    await transaction.$queryRaw`
      SELECT "id" FROM "study_sessions" WHERE "id" = ${session.id}::uuid FOR UPDATE
    `;

    const blocks = await transaction.studySessionBlock.findMany({
      orderBy: { position: "asc" },
      where: { sessionId: session.id },
    });

    return run({ session: { ...session, blocks }, transaction });
  });
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
