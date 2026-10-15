import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { arePhaseChallengesRequired } from "../../checkpoints/_utils/phase-challenge-access";
import { type AllowanceLimit } from "../../entitlements/contract";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { getStoredBlockWait } from "../../sessions/block-wait";
import { type StartStudyBlockResult, startStudyBlock } from "../../sessions/start-study-block";
import { getSession } from "../../users/get-session";
import { findLearnerLanguageGoal } from "../_utils/language-goal";
import { startExamTask } from "../exam-speaking/_utils/start-exam-task";
import { findLanguageCheckpointBlock, toCheckpointScenarioUnit } from "./_utils/checkpoint-block";
import { getSpeakingLevel } from "./_utils/conversation-goal";
import { findUnitScenario, getUnitScenario } from "./_utils/conversation-scenario";
import { createConversation } from "./_utils/create-conversation";
import { readLiveCallAdmission } from "./_utils/live-call-policy";
import {
  findSpeakingMockSetup,
  findWaitingSpeakingMock,
  writeSpeakingMock,
} from "./_utils/speaking-mock";
import {
  type LanguageConversationStartInput,
  type LanguageConversationView,
} from "./conversation-contract";
import { getCheckpointMinutes } from "./conversation-rules";

/** The existing intro, before a checkpoint has a learner-owned conversation. */
export type LanguageConversationIntro = Pick<
  LanguageConversationView,
  | "character"
  | "exam"
  | "examTask"
  | "kind"
  | "level"
  | "minutes"
  | "objectives"
  | "situation"
  | "targetLanguage"
  | "title"
>;

type StartedCall =
  | { conversationId: string; status: "ready" }
  | { status: "notFound" | "notLanguage" | "unauthorized" };

type CheckpointRefusal = Exclude<
  StartStudyBlockResult,
  { status: "notFound" | "ready" | "unauthorized" }
>;

/**
 * An exam's speaking task comes with Plus, like every mock exam, and waits when the plan's call
 * time left can't fit it.
 */
export type StartLanguageConversationResult =
  | StartedCall
  | CheckpointRefusal
  | { limit: AllowanceLimit; status: "limitReached" }
  | { status: "callsPaused" | "plusRequired" };

/** Opening a checkpoint's screen: its call, or the unit whose call isn't written yet. */
export type OpenLanguageCheckpointCallResult =
  | StartedCall
  | CheckpointRefusal
  | { status: "plusRequired" }
  | { intro: LanguageConversationIntro; status: "notStarted" }
  | { status: "preparing"; unitTitle: string };

async function startPractice({
  input,
  userId,
}: {
  input: Extract<LanguageConversationStartInput, { kind: "practice" }>;
  userId: string;
}): Promise<StartedCall> {
  const chapter = await prisma.chapter.findFirst({
    where: { ...libraryRowsVisibleTo(userId), id: input.chapterId },
  });

  if (!chapter) {
    return { status: "notFound" };
  }

  const { targetLanguage } = chapter;

  if (!targetLanguage) {
    return { status: "notLanguage" };
  }

  const goal = await findLearnerLanguageGoal({ goalId: input.goalId, targetLanguage, userId });
  const level = await getSpeakingLevel({ goal, targetLanguage, userId });
  const scenario = await getUnitScenario({ level, unit: { ...chapter, targetLanguage }, userId });

  const conversation = await createConversation({
    chapterId: chapter.id,
    goal,
    kind: "practice",
    language: chapter.language,
    level,
    markChanged: true,
    minutes: input.minutes,
    scenario,
    targetLanguage,
    userId,
  });

  return { conversationId: conversation.id, status: "ready" };
}

async function loadAccessibleCheckpoint({ blockId, userId }: { blockId: string; userId: string }) {
  const checkpoint = await findLanguageCheckpointBlock({ blockId, userId });
  const targetLanguage = checkpoint?.goal.targetLanguage;

  if (!checkpoint || !targetLanguage) {
    return { status: "notLanguage" as const };
  }

  if (!(await arePhaseChallengesRequired({ goalKind: checkpoint.goal.kind, userId }))) {
    return { status: "plusRequired" as const };
  }

  return { ...checkpoint, status: "ready" as const, targetLanguage };
}

/**
 * A language goal's checkpoint is the unit's conversation. Opening the same block again returns
 * the call already made for it, so a reload never starts a second one. Without `write`, a unit
 * whose call isn't written yet is left `preparing` instead of waiting on a model.
 */
async function startCheckpoint({
  blockId,
  userId,
  write,
}: {
  blockId: string;
  userId: string;
  write: boolean;
}): Promise<OpenLanguageCheckpointCallResult> {
  const checkpoint = await loadAccessibleCheckpoint({ blockId, userId });

  if (checkpoint.status !== "ready") {
    return checkpoint;
  }

  const { goal, targetLanguage, unit } = checkpoint;

  const session = await prisma.studySession.findFirst({
    include: { blocks: true },
    where: { blocks: { some: { id: blockId } }, userId },
  });

  const block = session?.blocks.find((candidate) => candidate.id === blockId);

  if (!session || !block) {
    return { status: "notFound" };
  }

  if (write) {
    const started = await startStudyBlock({ blockId, input: {}, sessionId: session.id });

    if (started.status !== "ready") {
      return started;
    }
  } else {
    const reason = getStoredBlockWait({ block, blocks: session.blocks });

    if (reason) {
      return { reason, status: "earlierFirst" };
    }
  }

  const existing = await prisma.languageConversation.findUnique({
    select: { id: true, userId: true },
    where: { studyBlockId: blockId },
  });

  if (existing) {
    return existing.userId === userId
      ? { conversationId: existing.id, status: "ready" }
      : { status: "notFound" };
  }

  const level = await getSpeakingLevel({ goal, targetLanguage, userId });

  const scenario = write
    ? await getUnitScenario({
        level,
        unit: toCheckpointScenarioUnit({ goal, targetLanguage, unit }),
        userId,
      })
    : await findUnitScenario({ chapterId: unit.chapterId, level });

  if (!scenario || !write) {
    return scenario
      ? {
          intro: {
            character: scenario.character,
            exam: null,
            examTask: null,
            kind: "checkpoint",
            level,
            minutes: getCheckpointMinutes(level),
            objectives: scenario.objectives.map((objective) => ({ ...objective, met: false })),
            situation: scenario.situation,
            targetLanguage,
            title: scenario.title,
          },
          status: "notStarted",
        }
      : { status: "preparing", unitTitle: unit.title };
  }

  try {
    const conversation = await createConversation({
      chapterId: unit.chapterId,
      goal,
      kind: "checkpoint",
      language: goal.language,
      level,
      markChanged: true,
      minutes: getCheckpointMinutes(level),
      scenario,
      studyBlockId: blockId,
      targetLanguage,
      userId,
    });

    return { conversationId: conversation.id, status: "ready" };
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const winner = await prisma.languageConversation.findUniqueOrThrow({
      where: { studyBlockId: blockId },
    });

    return { conversationId: winner.id, status: "ready" };
  }
}

/**
 * The goal's speaking mock: the one written ahead when it's waiting (after a mock, and while a
 * session is prepared), else a new one written now.
 */
async function startSpeakingMock({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<StartedCall | { status: "callsPaused" }> {
  const setup = await findSpeakingMockSetup({ goalId, userId });

  if (!setup) {
    return { status: "notLanguage" };
  }

  if ((await readLiveCallAdmission({ transaction: prisma, userId })) === null) {
    return { status: "callsPaused" };
  }

  const conversation = (await findWaitingSpeakingMock(setup)) ?? (await writeSpeakingMock(setup));
  return { conversationId: conversation.id, status: "ready" };
}

/**
 * Starts a live conversation for the learner: practice for a unit (1 to 5 minutes), a language
 * goal's checkpoint (the unit's call, its length set by the learner's level), a speaking mock for
 * IELTS or TOEFL iBT, as the goal names it, or one task of a DELE, DELF, Goethe or Cambridge
 * speaking paper (Plus only), its call as long as the task's official time. The character speaks
 * at the learner's speaking level, an exam's examiner at the exam's. Nothing is charged until the
 * call connects.
 */
export async function startLanguageConversation(
  input: LanguageConversationStartInput,
): Promise<StartLanguageConversationResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  if (input.kind === "checkpoint") {
    const started = await startCheckpoint({ blockId: input.blockId, userId, write: true });
    // Writing the unit's call never leaves it preparing.
    return started.status === "preparing" || started.status === "notStarted"
      ? { status: "notFound" }
      : started;
  }

  if (input.kind === "speakingMock") {
    return startSpeakingMock({ goalId: input.goalId, userId });
  }

  if (input.kind === "examSpeaking") {
    return startExamTask({ goalId: input.goalId, task: input.task, userId });
  }

  return startPractice({ input, userId });
}

/**
 * A language checkpoint's saved call or its read-only intro. Opening a screen creates nothing:
 * the learner's Start POST creates the conversation, writing its scenario only when still needed.
 */
export async function openLanguageCheckpointCall(
  blockId: string,
): Promise<OpenLanguageCheckpointCallResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const completed = await prisma.languageConversation.findFirst({
    where: {
      kind: "checkpoint",
      status: "completed",
      studyBlockId: blockId,
      userId: session.user.id,
    },
  });

  if (completed) {
    return { conversationId: completed.id, status: "ready" };
  }

  return startCheckpoint({ blockId, userId: session.user.id, write: false });
}
