import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { libraryRowsVisibleTo } from "../../library/_utils/library-visibility";
import { getSession } from "../../users/get-session";
import { findLearnerLanguageGoal } from "../_utils/language-goal";
import { findLanguageCheckpointBlock, toCheckpointScenarioUnit } from "./_utils/checkpoint-block";
import { getSpeakingLevel } from "./_utils/conversation-goal";
import { findUnitScenario, getUnitScenario } from "./_utils/conversation-scenario";
import { createConversation } from "./_utils/create-conversation";
import {
  findSpeakingMockSetup,
  findWaitingSpeakingMock,
  writeSpeakingMock,
} from "./_utils/speaking-mock";
import { type LanguageConversationStartInput } from "./conversation-contract";
import { getCheckpointMinutes } from "./conversation-rules";

export type StartLanguageConversationResult =
  | { conversationId: string; status: "ready" }
  | { status: "notFound" | "notLanguage" | "unauthorized" };

/** Opening a checkpoint's screen: its call, or the unit whose call isn't written yet. */
export type OpenLanguageCheckpointCallResult =
  | StartLanguageConversationResult
  | { status: "preparing"; unitTitle: string };

async function startPractice({
  input,
  userId,
}: {
  input: Extract<LanguageConversationStartInput, { kind: "practice" }>;
  userId: string;
}): Promise<StartLanguageConversationResult> {
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
    minutes: input.minutes,
    scenario,
    targetLanguage,
    userId,
  });

  return { conversationId: conversation.id, status: "ready" };
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
  const existing = await prisma.languageConversation.findUnique({
    select: { id: true, userId: true },
    where: { studyBlockId: blockId },
  });

  if (existing) {
    return existing.userId === userId
      ? { conversationId: existing.id, status: "ready" }
      : { status: "notFound" };
  }

  const checkpoint = await findLanguageCheckpointBlock({ blockId, userId });
  const targetLanguage = checkpoint?.goal.targetLanguage;

  if (!checkpoint || !targetLanguage) {
    return { status: "notLanguage" };
  }

  const { goal, unit } = checkpoint;
  const level = await getSpeakingLevel({ goal, targetLanguage, userId });

  const scenario = write
    ? await getUnitScenario({
        level,
        unit: toCheckpointScenarioUnit({ goal, targetLanguage, unit }),
        userId,
      })
    : await findUnitScenario({ chapterId: unit.chapterId, level });

  if (!scenario) {
    return { status: "preparing", unitTitle: unit.title };
  }

  try {
    const conversation = await createConversation({
      chapterId: unit.chapterId,
      goal,
      kind: "checkpoint",
      language: goal.language,
      level,
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
}): Promise<StartLanguageConversationResult> {
  const setup = await findSpeakingMockSetup({ goalId, userId });

  if (!setup) {
    return { status: "notLanguage" };
  }

  const conversation = (await findWaitingSpeakingMock(setup)) ?? (await writeSpeakingMock(setup));
  return { conversationId: conversation.id, status: "ready" };
}

/**
 * Starts a live conversation for the learner: practice for a unit (1 to 5 minutes), a language
 * goal's checkpoint (the unit's call, its length set by the learner's level), or a speaking mock
 * for IELTS or TOEFL iBT, as the goal names it. The character speaks at the learner's speaking
 * level. Nothing is charged until the call connects.
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
    return started.status === "preparing" ? { status: "notFound" } : started;
  }

  if (input.kind === "speakingMock") {
    return startSpeakingMock({ goalId: input.goalId, userId });
  }

  return startPractice({ input, userId });
}

/**
 * A language checkpoint's call as its screen opens: the call already made for the block, or a new
 * one from the unit's call when it's written (a session's preparation writes it ahead). Nothing is
 * written by a model here, since opening a screen never starts generation: `preparing` means the
 * unit's call isn't written yet, and starting the checkpoint (`startLanguageConversation`) writes
 * it.
 */
export async function openLanguageCheckpointCall(
  blockId: string,
): Promise<OpenLanguageCheckpointCallResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  return startCheckpoint({ blockId, userId: session.user.id, write: false });
}
