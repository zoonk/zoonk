import "server-only";
import { isLiveCallAvailable } from "@zoonk/ai/tasks/language/live-call-session";
import { prisma } from "@zoonk/db";
import { type AllowanceLimit } from "../../entitlements/contract";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { getStoredBlockWait } from "../../sessions/block-wait";
import { saveDayBeforeActivity } from "../../sessions/ensure-study-session";
import { getSession } from "../../users/get-session";
import { findLearnerLanguageGoal } from "../_utils/language-goal";
import { startExamTask } from "../exam-speaking/_utils/start-exam-task";
import {
  type CheckpointRefusal,
  findBlockConversation,
  findCheckpointBlock,
  startCheckpointCall,
} from "./_utils/checkpoint-call";
import { getSpeakingLevel } from "./_utils/conversation-goal";
import { findUnitScenario, toScenarioUnit } from "./_utils/conversation-scenario";
import { createConversation } from "./_utils/create-conversation";
import { findSpeakingMockSetup, findWaitingSpeakingMock } from "./_utils/speaking-mock";
import { type PreparingCall } from "./call-writing-contract";
import { type LanguageCheckpointCall } from "./checkpoint-call-contract";
import { type LanguageConversationStartInput } from "./conversation-contract";
import { getCheckpointMinutes } from "./conversation-rules";

type StartedCall =
  | { conversationId: string; sessionId?: string; status: "ready" }
  | { status: "notFound" | "notLanguage" | "unauthorized" };

export type StartLanguageConversationResult =
  | PreparingCall
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
}): Promise<PreparingCall | StartedCall | { status: "callsPaused" }> {
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

  if (!isLiveCallAvailable()) {
    return { status: "callsPaused" };
  }

  const goal = await findLearnerLanguageGoal({ goalId: input.goalId, targetLanguage, userId });
  const level = await getSpeakingLevel({ goal, targetLanguage, userId });
  const scenario = await findUnitScenario({ chapterId: chapter.id, level });

  if (!scenario) {
    const unit = toScenarioUnit({ ...chapter, targetLanguage });
    return { status: "preparing", writing: { kind: "unitScenario", level, unit, userId } };
  }

  await saveDayBeforeActivity({ goalId: input.goalId, language: targetLanguage, userId });

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

  return {
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
  };
}

async function startSpeakingMock({
  goalId,
  userId,
}: {
  goalId: string;
  userId: string;
}): Promise<PreparingCall | StartedCall | { status: "callsPaused" }> {
  const setup = await findSpeakingMockSetup({ goalId, userId });

  if (!setup) {
    return { status: "notLanguage" };
  }

  if (!isLiveCallAvailable()) {
    return { status: "callsPaused" };
  }

  const waiting = await findWaitingSpeakingMock(setup);

  if (!waiting) {
    return { status: "preparing", writing: { goalId, kind: "speakingMock", userId } };
  }

  await saveDayBeforeActivity({ goalId, language: setup.goal.targetLanguage, userId });
  return { conversationId: waiting.id, status: "ready" };
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
    return startCheckpointCall({ blockId: input.blockId, userId });
  }

  if (input.kind === "speakingMock") {
    return startSpeakingMock({ goalId: input.goalId, userId });
  }

  if (input.kind === "examSpeaking") {
    return startExamTask({ goalId: input.goalId, task: input.task, userId });
  }

  return startPractice({ input, userId });
}

/** Read-only: the Start POST creates the conversation, or asks for its scenario to be written. */
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
