import { prisma } from "@zoonk/db";
import { studySessionBlockFixture } from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { answerBlockInOrder } from "../sessions/_test-utils/answer-block";
import {
  SESSION_NOW,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../sessions/_test-utils/session-goal";
import { BRAIN_POWER_BONUS } from "../sessions/brain-power";
import { finishStudyBlock } from "../sessions/finish-study-block";
import { getTodayStudySession } from "../sessions/get-today-study-session";
import { startStudyBlock } from "../sessions/start-study-block";
import { getCheckpoint } from "./get-checkpoint";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));
vi.mock("next/headers", () => ({ headers: vi.fn(async () => new Headers()) }));
vi.mock("@zoonk/ai/tasks/v2/mistakes/cause", () => ({ classifyMistakeCause: vi.fn() }));

/** A learner whose first phase (two lessons) is done, so today's session is the phase's boss. */
async function reachedBoss() {
  const user = await userFixture();
  const fixture = await sessionGoalFixture({ lessons: 3, userId: user.id });
  const [first, second, third] = fixture.planItems;

  await Promise.all([
    prisma.planItem.update({ data: { phase: 1, position: 5 }, where: { id: third?.id } }),
    prisma.planItem.updateMany({
      data: { status: "done" },
      where: { id: { in: [first?.id ?? "", second?.id ?? ""] } },
    }),
  ]);

  await checkpointItemFixture({ kind: "boss", planId: fixture.plan.id, position: 2 });
  mockSession(user.id);

  const today = await getTodayStudySession({ goalId: fixture.goal.id });

  const block =
    today.status === "ready"
      ? today.session.blocks.find((candidate) => candidate.kind === "checkpoint")
      : undefined;

  if (!block || today.status !== "ready") {
    throw new Error("Expected today's boss");
  }

  return { block, sessionId: today.session.id, user };
}

describe(getCheckpoint, () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("says upfront what the boss asks and what winning is worth, without the answers", async () => {
    const { block, sessionId } = await reachedBoss();
    const result = await getCheckpoint(block.id);

    expect(result).toMatchObject({
      checkpoint: {
        blockId: block.id,
        checklist: [],
        kind: "boss",
        mock: false,
        nextPhase: { index: 1, name: "Practice" },
        passMark: 5,
        phase: { index: 0, name: "Basics" },
        reinforcementLessons: 2,
        rematch: false,
        result: null,
        reward: {
          badge: true,
          brainPower: BRAIN_POWER_BONUS.phaseBoss,
          glasses: "star",
          phaseComplete: true,
        },
        sessionId,
        status: "pending",
      },
      status: "ready",
    });

    const questions = result.status === "ready" ? result.checkpoint.questions : [];

    expect(questions).toHaveLength(6);
    expect(questions[0]).toMatchObject({ answered: null, format: "multipleChoice" });
    expect(questions[0]).not.toHaveProperty("correctAnswer");
  });

  it("shows how a finished duel went, and no glasses left to earn once they're won", async () => {
    const { block, sessionId } = await reachedBoss();

    await startStudyBlock({ blockId: block.id, input: {}, sessionId });
    await answerBlockInOrder({ blockId: block.id, optionIndex: 0, sessionId });
    await finishStudyBlock({ blockId: block.id, input: {}, sessionId });

    await expect(getCheckpoint(block.id)).resolves.toMatchObject({
      checkpoint: {
        result: { correct: 6, passed: true, total: 6 },
        reward: { glasses: null },
        status: "completed",
      },
      status: "ready",
    });
  });

  it("keeps other learners' checkpoints and other blocks out of reach", async () => {
    const [{ block, sessionId, user }, other] = await Promise.all([reachedBoss(), userFixture()]);
    const lesson = await studySessionBlockFixture({ kind: "learn", position: 1, sessionId });

    mockSession(other.id);
    await expect(getCheckpoint(block.id)).resolves.toStrictEqual({ status: "notFound" });

    mockSession(user.id);
    await expect(getCheckpoint(lesson.id)).resolves.toStrictEqual({ status: "notFound" });
    await expect(getCheckpoint("not-a-block")).resolves.toStrictEqual({ status: "notFound" });

    mockSession(null);
    await expect(getCheckpoint(block.id)).resolves.toStrictEqual({ status: "unauthorized" });
  });
});
