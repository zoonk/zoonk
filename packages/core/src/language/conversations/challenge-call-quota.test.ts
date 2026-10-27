import { checkConversationObjectives } from "@zoonk/ai/tasks/v2/language/conversation-objectives";
import { createLiveCallSession } from "@zoonk/ai/tasks/v2/language/live-call-session";
import { prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupTestCalls,
  connectTestCall,
  reserveTestCall,
  setupTestCalls,
  testCallCompletionInput,
} from "../../_test-utils/connect-test-call";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import { reviewRunsInline } from "../../_test-utils/review-runs";
import { getChallenge } from "../../checkpoints/get-challenge";
import { getAllowance } from "../../entitlements/get-allowance";
import { completeLanguageConversation } from "./complete-language-conversation";
import { getLanguageConversation } from "./get-language-conversation";
import {
  openLanguageCheckpointCall,
  startLanguageConversation,
} from "./start-language-conversation";

/** A Plus learner has reached the renting unit's C1 challenge (three minutes of talk). */
async function reachedChallenge() {
  const setup = await languageGoalFixture();
  const { goal, plan, renting, user } = setup;
  await prisma.planItem.updateMany({ data: { status: "done" }, where: { planId: plan.id } });

  const [item, session] = await Promise.all([
    planItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 10 }),
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    prisma.languageSkillLevel.create({
      data: { language: "en", score: 4, skill: "speaking", startScore: 4, userId: user.id },
    }),
    prisma.conversationScenario.create({
      data: {
        chapterId: renting.id,
        content: RENTING_SCENARIO,
        level: "C1",
        model: "test",
        promptVersion: "test",
        runId: "test",
      },
    }),
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
  ]);

  const block = await studySessionBlockFixture({
    kind: "checkpoint",
    payload: {
      checkpoint: {
        kind: "boss",
        mock: false,
        passMark: 0,
        phase: 1,
        rematch: false,
        timeLimitMinutes: null,
      },
      planItemId: item.id,
    },
    sessionId: session.id,
  });

  mockSession(user.id);
  const started = await startLanguageConversation({ blockId: block.id, kind: "checkpoint" });

  if (started.status !== "ready") {
    throw new Error(`Challenge did not start: ${started.status}`);
  }

  return { ...setup, block, conversationId: started.conversationId, item };
}

describe("Plus challenge call quota", () => {
  beforeEach(async () => {
    await setupTestCalls();
    freezeClock();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    // Only the call provider and objective model are replaced; all plan and usage rows are real.
    vi.mocked(checkConversationObjectives).mockResolvedValue({
      data: {
        met: RENTING_SCENARIO.objectives.map(({ label }) => ({
          label,
          learnerWords: "Book a viewing",
        })),
      },
      provenance: {
        generatedAt: new Date().toISOString(),
        latencyMs: 1,
        model: "test",
        promptVersion: "test",
        provider: "openai",
        requestedModel: "test",
        runId: "test",
        usage: {},
      },
      systemPrompt: "",
      usage: undefined as never,
      userPrompt: "",
    });
  });

  afterEach(cleanupTestCalls);

  it("bounds every reconnect by the challenge's original length, even below a practice call's minimum", async () => {
    const { conversationId } = await reachedChallenge();
    await connectTestCall(conversationId);
    vi.setSystemTime(new Date(Date.now() + 150_000));

    await expect(connectTestCall(conversationId)).resolves.toMatchObject({
      setup: { endsAtLimit: null, seconds: 30 },
      status: "ready",
    });

    vi.setSystemTime(new Date(Date.now() + 30_000));

    await expect(reserveTestCall(conversationId)).resolves.toStrictEqual({
      status: "conversationEnded",
    });

    expect(createLiveCallSession).toHaveBeenCalledTimes(2);
  });

  it("keeps completed challenge feedback readable after Plus lapses", async () => {
    const { block, conversationId, item, user } = await reachedChallenge();
    await connectTestCall(conversationId);
    vi.setSystemTime(new Date(Date.now() + 180_000));

    await completeLanguageConversation({
      conversationId,
      input: testCallCompletionInput(conversationId, {
        spokenSeconds: 180,
        turns: [],
        usedHelp: false,
      }),
      runs: reviewRunsInline,
    });

    await expect(getLanguageConversation(conversationId)).resolves.toMatchObject({
      conversation: { locked: false, result: expect.any(Object), status: "completed" },
      status: "ready",
    });

    await prisma.subscription.updateMany({
      data: { status: "canceled" },
      where: { referenceId: user.id },
    });

    await expect(openLanguageCheckpointCall(block.id)).resolves.toStrictEqual({
      conversationId,
      status: "ready",
    });

    await expect(
      completeLanguageConversation({
        conversationId,
        input: testCallCompletionInput(conversationId, {
          spokenSeconds: 180,
          turns: [],
          usedHelp: false,
        }),
        runs: reviewRunsInline,
      }),
    ).resolves.toMatchObject({
      conversation: { locked: true, result: expect.any(Object), status: "completed" },
      status: "completed",
    });

    await expect(getLanguageConversation(conversationId)).resolves.toMatchObject({
      conversation: { locked: true, result: expect.any(Object), status: "completed" },
      status: "ready",
    });

    await expect(getChallenge({ input: {}, planItemId: item.id })).resolves.toMatchObject({
      challenge: { locked: true, status: "plusRequired" },
      status: "ready",
    });

    // A passed challenge keeps its completed status while access to another call needs Plus.
    await prisma.planItem.update({ data: { status: "done" }, where: { id: item.id } });

    await expect(getChallenge({ input: {}, planItemId: item.id })).resolves.toMatchObject({
      challenge: { locked: true, status: "done" },
      status: "ready",
    });
  });

  it("returns the Plus lock immediately when Plus lapses during a challenge call", async () => {
    const { conversationId, user } = await reachedChallenge();
    await connectTestCall(conversationId);

    await prisma.subscription.updateMany({
      data: { status: "canceled" },
      where: { referenceId: user.id },
    });

    await expect(
      completeLanguageConversation({
        conversationId,
        input: testCallCompletionInput(conversationId, {
          spokenSeconds: 0,
          turns: [],
          usedHelp: false,
        }),
        runs: reviewRunsInline,
      }),
    ).resolves.toMatchObject({
      conversation: { locked: true, result: { passed: false }, status: "completed" },
      status: "completed",
    });
  });

  it("locks a previously opened challenge call after Plus lapses", async () => {
    const { block, conversationId, user } = await reachedChallenge();

    await prisma.subscription.updateMany({
      data: { status: "canceled" },
      where: { referenceId: user.id },
    });

    await expect(openLanguageCheckpointCall(block.id)).resolves.toStrictEqual({
      status: "plusRequired",
    });

    await expect(reserveTestCall(conversationId)).resolves.toStrictEqual({
      status: "plusRequired",
    });

    expect(createLiveCallSession).not.toHaveBeenCalled();
    await expect(getAllowance()).resolves.toMatchObject({ callTime: { usedSeconds: 0 } });
  });

  it("leaves Plus call metering and limits unchanged", async () => {
    const { conversationId, user } = await reachedChallenge();

    await expect(reserveTestCall(conversationId)).resolves.toMatchObject({
      setup: { seconds: 180 },
      status: "ready",
    });

    await expect(getAllowance()).resolves.toMatchObject({
      callTime: { usedSeconds: 180 },
      tier: "plus",
    });

    await usageRecordsFixture({ count: 1, kind: "conversation", seconds: 1200, userId: user.id });

    await expect(reserveTestCall(conversationId)).resolves.toMatchObject({
      limit: { resource: "callSeconds", tier: "plus" },
      status: "limitReached",
    });
  });
});
