import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { arePhaseChallengesRequired } from "../../checkpoints/_utils/phase-challenge-access";
import { type AllowanceLimit } from "../../entitlements/contract";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { getRequestProgressDateContext } from "../../progress/get-request-date-context";
import { readDailyTimeLimitReached } from "../../sessions/_utils/daily-time-limit";
import { getStoredBlockWait } from "../../sessions/block-wait";
import { saveDayBeforeActivity } from "../../sessions/ensure-study-session";
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
  type LanguageCheckpointCall,
  type LanguageConversationIntro,
} from "./checkpoint-call-contract";
import { type LanguageConversationStartInput } from "./conversation-contract";
import { getCheckpointMinutes } from "./conversation-rules";

type StartedCall =
  | { conversationId: string; sessionId?: string; status: "ready" }
  | { status: "notFound" | "notLanguage" | "unauthorized" };

type CheckpointRefusal = Exclude<
  StartStudyBlockResult,
  { status: "notFound" | "ready" | "unauthorized" }
>;

export type StartLanguageConversationResult =
  | StartedCall
  | CheckpointRefusal
  | { limit: AllowanceLimit; status: "limitReached" }
  | { status: "callsPaused" | "plusRequired" };

export type OpenLanguageCheckpointCallResult =
  | LanguageCheckpointCall
  | { status: "notFound" | "unauthorized" };

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

  await saveDayBeforeActivity({ goalId: input.goalId, language: targetLanguage, userId });

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

async function introWithDailyLimit({
  intro,
  pending,
  userId,
}: {
  intro: LanguageConversationIntro;
  pending: boolean;
  userId: string;
}): Promise<Extract<OpenLanguageCheckpointCallResult, { status: "notStarted" }>> {
  if (!pending) {
    return { dailyLimitReached: false, intro, status: "notStarted" };
  }

  const { currentDate } = await getRequestProgressDateContext();
  const dailyLimitReached = await readDailyTimeLimitReached({ date: currentDate, userId });
  return { dailyLimitReached, intro, status: "notStarted" };
}

async function findCheckpointBlock({ blockId, userId }: { blockId: string; userId: string }) {
  const checkpoint = await loadAccessibleCheckpoint({ blockId, userId });

  if (checkpoint.status !== "ready") {
    return checkpoint;
  }

  const session = await prisma.studySession.findFirst({
    include: { blocks: true },
    where: { blocks: { some: { id: blockId } }, userId },
  });

  const block = session?.blocks.find((candidate) => candidate.id === blockId);

  return session && block
    ? { block, checkpoint, session, status: "ready" as const }
    : { status: "notFound" as const };
}

function findBlockConversation(blockId: string) {
  return prisma.languageConversation.findUnique({
    select: { id: true, userId: true },
    where: { studyBlockId: blockId },
  });
}

async function startCheckpoint({
  blockId,
  userId,
}: {
  blockId: string;
  userId: string;
}): Promise<StartLanguageConversationResult> {
  const found = await findCheckpointBlock({ blockId, userId });

  if (found.status !== "ready") {
    return found;
  }

  const { goal, targetLanguage, unit } = found.checkpoint;
  const sessionId = found.session.id;
  const started = await startStudyBlock({ blockId, input: {}, sessionId });

  if (started.status !== "ready") {
    return started;
  }

  const existing = await findBlockConversation(blockId);

  if (existing) {
    return existing.userId === userId
      ? { conversationId: existing.id, sessionId, status: "ready" }
      : { status: "notFound" };
  }

  const level = await getSpeakingLevel({ goal, targetLanguage, userId });

  const scenario = await getUnitScenario({
    level,
    unit: toCheckpointScenarioUnit({ goal, targetLanguage, unit }),
    userId,
  });

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

    return { conversationId: conversation.id, sessionId, status: "ready" };
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const winner = await prisma.languageConversation.findUniqueOrThrow({
      where: { studyBlockId: blockId },
    });

    return { conversationId: winner.id, sessionId, status: "ready" };
  }
}

async function readCheckpointCall({
  blockId,
  userId,
}: {
  blockId: string;
  userId: string;
}): Promise<OpenLanguageCheckpointCallResult> {
  const found = await findCheckpointBlock({ blockId, userId });

  if (found.status !== "ready") {
    return found;
  }

  const { block, session } = found;
  const { goal, targetLanguage, unit } = found.checkpoint;
  const reason = getStoredBlockWait({ block, blocks: session.blocks });

  if (reason) {
    return { reason, status: "earlierFirst" };
  }

  const existing = await findBlockConversation(blockId);

  if (existing) {
    return existing.userId === userId
      ? { conversationId: existing.id, status: "ready" }
      : { status: "notFound" };
  }

  const level = await getSpeakingLevel({ goal, targetLanguage, userId });
  const scenario = await findUnitScenario({ chapterId: unit.chapterId, level });

  if (!scenario) {
    return { status: "preparing", unitTitle: unit.title };
  }

  return introWithDailyLimit({
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
    pending: block.status === "pending",
    userId,
  });
}

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

  await saveDayBeforeActivity({ goalId, language: setup.goal.targetLanguage, userId });

  if ((await readLiveCallAdmission({ transaction: prisma, userId })) === null) {
    return { status: "callsPaused" };
  }

  const conversation = (await findWaitingSpeakingMock(setup)) ?? (await writeSpeakingMock(setup));
  return { conversationId: conversation.id, status: "ready" };
}

export async function startLanguageConversation(
  input: LanguageConversationStartInput,
): Promise<StartLanguageConversationResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  if (input.kind === "checkpoint") {
    return startCheckpoint({ blockId: input.blockId, userId });
  }

  if (input.kind === "speakingMock") {
    return startSpeakingMock({ goalId: input.goalId, userId });
  }

  if (input.kind === "examSpeaking") {
    return startExamTask({ goalId: input.goalId, task: input.task, userId });
  }

  return startPractice({ input, userId });
}

/** Read-only: use the Start POST to create the conversation or write its scenario. */
export async function openLanguageCheckpointCall(
  blockId: string,
): Promise<OpenLanguageCheckpointCallResult> {
  "use cache: private";

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

  return readCheckpointCall({ blockId, userId: session.user.id });
}
