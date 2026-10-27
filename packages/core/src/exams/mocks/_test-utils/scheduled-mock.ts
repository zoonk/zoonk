import { prisma } from "@zoonk/db";
import { examBlueprintFixture } from "@zoonk/testing/fixtures/sources";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { mockSession } from "../../../_test-utils/mock-session";
import { getTodayStudySession } from "../../../sessions/_test-utils/open-today";
import {
  SESSION_TODAY,
  checkpointItemFixture,
  sessionGoalFixture,
} from "../../../sessions/_test-utils/session-goal";
import { getMock } from "../get-mock";
import { saveMockAnswer } from "../save-mock-answer";

export const MINUTE_MS = 60_000;
const DEFAULT_DAILY_MINUTES = 45;

function mockStructure(
  method: "itemResponseTheory" | "raw" | "wrongCancelsRight",
  minutes: number,
) {
  return {
    formats: [],
    mock: {
      adaptive: false,
      citations: [],
      order: null,
      scoring: { description: "How it's scored", method },
      sections: [{ day: null, kind: "objective", minutes, name: "Math", questions: 18 }],
      timeLimitMinutes: minutes,
      totalQuestions: 18,
    },
    rules: [],
    subjects: [],
  };
}

/**
 * A Plus learner's exam goal with today's weekly mock in the session. Item response theory scores
 * on ENEM's scale, so that exam is ENEM.
 */
export async function scheduledMockSetup(
  method: Parameters<typeof mockStructure>[0] = "raw",
  minutes = 30,
) {
  const user = await userFixture();

  const blueprint = await examBlueprintFixture({
    ...(method === "itemResponseTheory"
      ? { identityKey: `enem-${crypto.randomUUID()}`, name: "ENEM" }
      : {}),
    structure: mockStructure(method, minutes),
  });

  const fixture = await sessionGoalFixture({
    goal: {
      dailyMinutes: Math.max(DEFAULT_DAILY_MINUTES, minutes),
      examBlueprintId: blueprint.id,
      kind: "exam",
    },
    itemsPerSkill: 3,
    userId: user.id,
  });

  const [mockItem] = await Promise.all([
    checkpointItemFixture({
      kind: "mock",
      planId: fixture.plan.id,
      position: 10,
      scheduledFor: SESSION_TODAY,
    }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  mockSession(user.id);

  const today = await getTodayStudySession({ goalId: fixture.goal.id });
  const block = today.status === "ready" ? today.session.blocks.at(-1) : undefined;

  if (!block?.checkpoint?.mock) {
    throw new Error("Expected today's mock");
  }

  return { ...fixture, blockId: block.id, mockItem, user };
}

export async function runningMock(blockId: string) {
  const result = await getMock(blockId);

  if (result.status !== "ready" || !result.mock.current) {
    throw new Error("Expected a running mock");
  }

  return result.mock;
}

/** Answers the running section's first `count` questions right, and returns the running mock. */
export async function answerRight({ blockId, count }: { blockId: string; count: number }) {
  const running = await runningMock(blockId);
  const answered = (running.current?.questions ?? []).slice(0, count);

  await Promise.all(
    answered.map((question) =>
      saveMockAnswer({
        blockId,
        input: {
          answer: { selectedIndex: 0 },
          durationMs: 30_000,
          flagged: false,
          itemId: question.itemId,
        },
      }),
    ),
  );

  return running;
}
