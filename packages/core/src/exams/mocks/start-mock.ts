import "server-only";
import { isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
import { startStudyBlock } from "../../sessions/start-study-block";
import { buildMockConditions } from "./_utils/mock-conditions";
import { findOwnedMock } from "./_utils/owned-mock";
import { type MockTimeZoneInput } from "./mock-contract";

export type StartMockResult = {
  status:
    | "blockFinished"
    | "dailyLimitReached"
    | "finished"
    | "notFound"
    | "ready"
    | "unauthorized";
};

/**
 * Starts the mock when the learner takes it on: its session block starts (a guardian's daily
 * limit is checked there), the sections are fixed and the first one's clock starts. Starting a
 * running mock again resumes it.
 */
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

  if (owned.mock) {
    return { status: owned.mock.status === "finished" ? "finished" : "ready" };
  }

  const started = await startStudyBlock({ blockId, input, sessionId: owned.block.sessionId });

  if (started.status !== "ready") {
    return { status: started.status };
  }

  const conditions = await buildMockConditions(owned);
  const now = new Date();

  try {
    await prisma.mockExam.create({
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
  } catch (error) {
    // Two taps on "Start" race to create the sitting; the one that lost resumes the other's.
    if (!isPrismaUniqueConstraintError(error)) {
      throw error;
    }
  }

  return { status: "ready" };
}
