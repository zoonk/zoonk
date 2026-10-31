import "server-only";
import { type StudySessionBlock, isPrismaUniqueConstraintError } from "@zoonk/db";
import { unchanged, writeLearnerChange } from "../../learner/_utils/write-learner-change";
import { startStudyBlock } from "../../sessions/start-study-block";
import { buildMockConditions } from "./_utils/mock-conditions";
import { findOwnedMock } from "./_utils/owned-mock";
import { type MockTimeZoneInput } from "./mock-contract";

export type StartMockResult = {
  status:
    | "blockFinished"
    | "dailyLimitReached"
    | "expired"
    | "finished"
    | "notFound"
    | "ready"
    | "unauthorized";
};

async function startScheduledBlock({
  block,
  input,
}: {
  block: Pick<StudySessionBlock, "id" | "sessionId">;
  input: MockTimeZoneInput;
}): Promise<StartMockResult> {
  const started = await startStudyBlock({ blockId: block.id, input, sessionId: block.sessionId });

  if (
    started.status === "questionsNeeded" ||
    started.status === "earlierFirst" ||
    started.status === "plusRequired"
  ) {
    throw new Error(`Mock block ${block.id} was refused as a phase challenge: ${started.status}.`);
  }

  return { status: started.status };
}

export async function startMock({
  blockId,
  input,
}: {
  blockId: string;
  input: MockTimeZoneInput;
}): Promise<StartMockResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { owned } = found;

  if (owned.mock?.status === "expired" && owned.block) {
    const { block, mock } = owned;

    await writeLearnerChange({ userId: owned.userId }, async (tx) => {
      const { count } = await tx.mockExam.updateMany({
        data: { blockId: null },
        where: { blockId: block.id, id: mock.id },
      });

      return count > 0 ? count : unchanged(count);
    });
  } else if (owned.mock) {
    if (owned.mock.status === "active" && owned.block) {
      return startScheduledBlock({ block: owned.block, input });
    }

    return { status: owned.mock.status === "active" ? "ready" : owned.mock.status };
  }

  if (!owned.block) {
    return { status: "notFound" };
  }

  const started = await startScheduledBlock({ block: owned.block, input });

  if (started.status !== "ready") {
    return started;
  }

  const conditions = await buildMockConditions(owned);
  const now = new Date();

  try {
    await writeLearnerChange<null>({ userId: owned.userId }, async (tx) => {
      const existing = await tx.mockExam.findUnique({ where: { blockId } });

      if (existing) {
        return unchanged(null);
      }

      await tx.mockExam.create({
        data: {
          blockId,
          conditions,
          examBlueprintId: owned.blueprint?.id ?? null,
          goalId: owned.goal?.id ?? null,
          sectionStartedAt: now,
          startedAt: now,
          userId: owned.userId,
        },
      });

      return null;
    });
  } catch (error) {
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }
  }

  return { status: "ready" };
}
