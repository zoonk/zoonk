import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { type CefrLevel } from "@zoonk/utils/cefr";
import { arePhaseChallengesRequired } from "../../../checkpoints/_utils/phase-challenge-access";
import { getStoredBlockWait } from "../../../sessions/block-wait";
import { getDailyTimeLimitStatus } from "../../../sessions/get-daily-time-limit";
import { type StartStudyBlockResult, startStudyBlock } from "../../../sessions/start-study-block";
import { type PreparingCall } from "../call-writing-contract";
import { type ConversationScenario } from "../conversation-contract";
import { getCheckpointMinutes } from "../conversation-rules";
import { findLanguageCheckpointBlock, toCheckpointScenarioUnit } from "./checkpoint-block";
import { getSpeakingLevel } from "./conversation-goal";
import { findUnitScenario, toScenarioUnit } from "./conversation-scenario";
import { createConversation } from "./create-conversation";

export type CheckpointRefusal = Exclude<
  StartStudyBlockResult,
  { status: "notFound" | "ready" | "unauthorized" }
>;

type StartedCheckpointCall =
  | CheckpointRefusal
  | PreparingCall
  | { conversationId: string; sessionId: string; status: "ready" }
  | { status: "notFound" | "notLanguage" | "plusRequired" | "unauthorized" };

async function loadAccessibleCheckpoint({ blockId, userId }: { blockId: string; userId: string }) {
  const checkpoint = await findLanguageCheckpointBlock({ blockId, userId });

  if (checkpoint.status !== "ready") {
    return checkpoint;
  }

  const { targetLanguage } = checkpoint.goal;

  if (!targetLanguage) {
    return { status: "notLanguage" as const };
  }

  if (!(await arePhaseChallengesRequired({ goalKind: checkpoint.goal.kind, userId }))) {
    return { status: "plusRequired" as const };
  }

  return { ...checkpoint, status: "ready" as const, targetLanguage };
}

type CheckpointBlock = Extract<
  Awaited<ReturnType<typeof loadAccessibleCheckpoint>>,
  { status: "ready" }
>;

export async function findCheckpointBlock({
  blockId,
  userId,
}: {
  blockId: string;
  userId: string;
}) {
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

export function findBlockConversation(blockId: string) {
  return prisma.languageConversation.findUnique({
    select: { id: true, userId: true },
    where: { studyBlockId: blockId },
  });
}

async function createCheckpointConversation({
  blockId,
  checkpoint,
  level,
  scenario,
  userId,
}: {
  blockId: string;
  checkpoint: CheckpointBlock;
  level: CefrLevel;
  scenario: ConversationScenario;
  userId: string;
}): Promise<string> {
  const { goal, targetLanguage, unit } = checkpoint;

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

    return conversation.id;
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }

    const winner = await prisma.languageConversation.findUniqueOrThrow({
      where: { studyBlockId: blockId },
    });

    return winner.id;
  }
}

/** What starting the block would refuse, read without starting it. */
async function findCheckpointRefusal({
  block,
  session,
}: Extract<
  Awaited<ReturnType<typeof findCheckpointBlock>>,
  { status: "ready" }
>): Promise<CheckpointRefusal | null> {
  if (block.status === "completed" || block.status === "skipped") {
    return { status: "blockFinished" };
  }

  const reason = getStoredBlockWait({ block, blocks: session.blocks });

  if (reason) {
    return { reason, status: "earlierFirst" };
  }

  const limit = block.status === "pending" ? await getDailyTimeLimitStatus() : null;
  return limit?.reached ? { status: "dailyLimitReached" } : null;
}

/** The scenario comes first, so a call still being written never starts the block's clock. */
export async function startCheckpointCall({
  blockId,
  userId,
}: {
  blockId: string;
  userId: string;
}): Promise<StartedCheckpointCall> {
  const found = await findCheckpointBlock({ blockId, userId });

  if (found.status !== "ready") {
    return found;
  }

  const { checkpoint } = found;
  const sessionId = found.session.id;
  const existing = await findBlockConversation(blockId);

  if (existing && existing.userId !== userId) {
    return { status: "notFound" };
  }

  const startBlock = () => startStudyBlock({ blockId, input: {}, sessionId });

  if (existing) {
    const started = await startBlock();

    return started.status === "ready"
      ? { conversationId: existing.id, sessionId, status: "ready" }
      : started;
  }

  const { goal, targetLanguage, unit } = checkpoint;
  const level = await getSpeakingLevel({ goal, targetLanguage, userId });
  const scenario = await findUnitScenario({ chapterId: unit.chapterId, level });

  if (!scenario) {
    const scenarioUnit = toScenarioUnit(toCheckpointScenarioUnit({ goal, targetLanguage, unit }));

    return (
      (await findCheckpointRefusal(found)) ?? {
        status: "preparing",
        writing: { kind: "unitScenario", level, unit: scenarioUnit, userId },
      }
    );
  }

  const started = await startBlock();

  if (started.status !== "ready") {
    return started;
  }

  const conversationId = await createCheckpointConversation({
    blockId,
    checkpoint,
    level,
    scenario,
    userId,
  });

  return { conversationId, sessionId, status: "ready" };
}
