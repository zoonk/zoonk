import { prisma } from "@zoonk/db";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../_test-utils/mock-session";
import { SESSION_NOW, SESSION_TODAY } from "../sessions/_test-utils/session-goal";
import { readBlockPayload, toBlockPayload } from "../sessions/block-payload";
import { startChallenge } from "./start-challenge";

async function challengeSetup({
  language = false,
  reason,
}: {
  language?: boolean;
  reason: "challenge" | "lessons";
}) {
  const user = await userFixture();

  const goal = await goalFixture({
    kind: language ? "language" : "learn",
    timezone: "UTC",
    userId: user.id,
  });

  const [plan, session] = await Promise.all([
    planFixture({ goalId: goal.id }),
    studySessionFixture({
      goalId: goal.id,
      localDate: SESSION_TODAY,
      missions: [],
      userId: user.id,
    }),
  ]);

  const challenge = await planItemFixture({ kind: "boss", planId: plan.id, position: 1 });

  const checkpoint = {
    kind: "boss",
    mock: false,
    passMark: 0,
    phase: 0,
    rematch: false,
    timeLimitMinutes: null,
  } as const;

  const [earlier, block] = await Promise.all([
    studySessionBlockFixture({
      kind: reason === "lessons" ? "learn" : "checkpoint",
      payload: toBlockPayload({ checkpoint: reason === "lessons" ? null : checkpoint }),
      position: 0,
      sessionId: session.id,
    }),
    studySessionBlockFixture({
      kind: "checkpoint",
      payload: toBlockPayload({ checkpoint, planItemId: challenge.id }),
      position: 1,
      sessionId: session.id,
    }),
  ]);

  mockSession(user.id);

  return { block, challenge, earlier, session, user };
}

describe("starting a challenge directly", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(SESSION_NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each(["lessons", "challenge"] as const)(
    "preserves the earlier %s refusal and unopened rows",
    async (reason) => {
      const { block, challenge, session, user } = await challengeSetup({ reason });

      await expect(startChallenge({ input: {}, planItemId: challenge.id })).resolves.toStrictEqual({
        reason,
        status: "earlierFirst",
      });

      await expect(
        prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
      ).resolves.toStrictEqual(session);

      await expect(
        prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
      ).resolves.toStrictEqual(block);

      await expect(
        prisma.learningEvent.count({ where: { kind: "session", userId: user.id } }),
      ).resolves.toBe(0);
    },
  );

  it("holds a language call for earlier lessons and starts its focused clock once they are skipped", async () => {
    const { block, challenge, earlier, session, user } = await challengeSetup({
      language: true,
      reason: "lessons",
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    await expect(startChallenge({ input: {}, planItemId: challenge.id })).resolves.toStrictEqual({
      reason: "lessons",
      status: "earlierFirst",
    });

    await prisma.studySessionBlock.update({
      data: { status: "skipped" },
      where: { id: earlier.id },
    });

    await expect(startChallenge({ input: {}, planItemId: challenge.id })).resolves.toStrictEqual({
      destination: { blockId: block.id, kind: "checkpoint", sessionId: session.id },
      status: "ready",
    });

    const started = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });

    expect(started).toMatchObject({ startedAt: SESSION_NOW, status: "active" });

    expect(readBlockPayload(started).timing).toStrictEqual({
      activeAt: SESSION_NOW.toISOString(),
      elapsedMs: 0,
    });
  });
});
