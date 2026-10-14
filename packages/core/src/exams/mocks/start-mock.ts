import "server-only";
import { type StudySessionBlock, isPrismaUniqueConstraintError, prisma } from "@zoonk/db";
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

/** A scheduled mock shares session focus, but never a phase challenge's prerequisites or bank. */
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

/**
 * Starts a scheduled mock when the learner takes it on: its session block starts (the learner's
 * daily limit is checked there), the sections are fixed and the first one's clock starts. Starting
 * a running mock again resumes it, a mock taken any time included. A scheduled one whose time ran
 * out while the learner was away starts again in a new sitting, its block freed from the old one;
 * one taken any time stays `expired` (the learner takes a new one).
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

  if (owned.mock?.status === "expired" && owned.block) {
    await prisma.mockExam.updateMany({
      data: { blockId: null },
      where: { blockId: owned.block.id, id: owned.mock.id },
    });
  } else if (owned.mock) {
    if (owned.mock.status === "active" && owned.block) {
      return startScheduledBlock({ block: owned.block, input });
    }

    return { status: owned.mock.status === "active" ? "ready" : owned.mock.status };
  }

  // A mock taken any time starts as it's made; only a scheduled one waits for its start.
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
