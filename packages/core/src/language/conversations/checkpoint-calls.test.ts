import { generateConversationScenario } from "@zoonk/ai/tasks/v2/language/conversation-scenario";
import { createLiveCallSession } from "@zoonk/ai/tasks/v2/language/live-call-session";
import { prisma } from "@zoonk/db";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { dailyProgressFixtureMany } from "@zoonk/testing/fixtures/progress";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { countDatabaseStatements } from "@zoonk/testing/statement-counter";
import { toUTCMidnight } from "@zoonk/utils/date";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cleanupTestCalls,
  connectTestCall,
  reserveTestCall,
  setupTestCalls,
} from "../../_test-utils/connect-test-call";
import { freezeClock } from "../../_test-utils/frozen-clock";
import { mockSession } from "../../_test-utils/mock-session";
import { getChallenge } from "../../checkpoints/get-challenge";
import { readBlockPayload } from "../../sessions/block-payload";
import { startStudyBlock } from "../../sessions/start-study-block";
import { prepareCheckpointCall } from "./prepare-language-calls";
import {
  openLanguageCheckpointCall,
  startLanguageConversation,
} from "./start-language-conversation";

const PROVENANCE = {
  generatedAt: new Date().toISOString(),
  latencyMs: 1,
  model: "openai/gpt-6-luna",
  promptVersion: "v-test",
  provider: "openai",
  requestedModel: "openai/gpt-6-luna",
  runId: "run-test",
  usage: {},
};

const B1_SCENARIO = { ...RENTING_SCENARIO, title: "Negociar o aluguel" };

async function reachedCheckpointFixture({ speaking }: { speaking: number }) {
  const setup = await languageGoalFixture();
  const { checkpoints, goal, items, user } = setup;
  const [arrived, boss] = checkpoints;

  if (!arrived || !boss) {
    throw new Error("Expected each unit's checkpoint");
  }

  await prisma.subscription.create({
    data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
  });

  const [session] = await Promise.all([
    studySessionFixture({ goalId: goal.id, userId: user.id }),
    prisma.planItem.updateMany({
      data: { status: "done" },
      where: { id: { in: [...items.slice(0, 2).map((item) => item.id), arrived.id] } },
    }),
    prisma.languageSkillLevel.create({
      data: {
        language: "en",
        score: speaking,
        skill: "speaking",
        startScore: speaking,
        userId: user.id,
      },
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
      planItemId: boss.id,
    },
    sessionId: session.id,
  });

  mockSession(user.id);
  return { ...setup, block, boss };
}

async function waitingCheckpointFixture({
  reason,
  speaking = 2,
}: {
  reason: "challenge" | "lessons";
  speaking?: number;
}) {
  const setup = await reachedCheckpointFixture({ speaking });

  const block = await prisma.studySessionBlock.update({
    data: { position: 1 },
    where: { id: setup.block.id },
  });

  const earlier = await studySessionBlockFixture({
    kind: reason === "lessons" ? "learn" : "checkpoint",
    ...(reason === "challenge" && { payload: readBlockPayload(block) }),
    position: 0,
    sessionId: block.sessionId,
  });

  const session = await prisma.studySession.findUniqueOrThrow({ where: { id: block.sessionId } });

  return { ...setup, block, earlier, session };
}

describe("language checkpoint calls", () => {
  beforeEach(async () => {
    freezeClock();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    await setupTestCalls();

    vi.mocked(generateConversationScenario).mockResolvedValue({
      data: B1_SCENARIO,
      provenance: PROVENANCE,
      systemPrompt: "",
      usage: undefined as never,
      userPrompt: "",
    });
  });

  afterEach(cleanupTestCalls);

  it("refuses a saved waiting call before claiming usage or minting a provider token", async () => {
    const { block, user } = await reachedCheckpointFixture({ speaking: 1 });
    const call = await startLanguageConversation({ blockId: block.id, kind: "checkpoint" });

    if (call.status !== "ready") {
      throw new Error("Expected the saved checkpoint call");
    }

    const shifted = await prisma.studySessionBlock.update({
      data: { position: 1 },
      where: { id: block.id },
    });

    await studySessionBlockFixture({ position: 0, sessionId: block.sessionId });

    await expect(reserveTestCall(call.conversationId)).resolves.toStrictEqual({
      reason: "lessons",
      status: "earlierFirst",
    });

    expect(createLiveCallSession).not.toHaveBeenCalled();
    await expect(prisma.usageRecord.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toStrictEqual(shifted);

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: call.conversationId } }),
    ).resolves.toMatchObject({ startedAt: null });
  });

  it("hands focus from the current question block to a call opened through its read-only screen", async () => {
    freezeClock();
    const { block } = await reachedCheckpointFixture({ speaking: 1 });
    const call = await startLanguageConversation({ blockId: block.id, kind: "checkpoint" });

    if (call.status !== "ready") {
      throw new Error("Expected the saved checkpoint call");
    }

    const other = await studySessionBlockFixture({ kind: "practice", sessionId: block.sessionId });
    await startStudyBlock({ blockId: other.id, input: {}, sessionId: block.sessionId });
    const now = new Date(Date.now() + 20_000);
    vi.setSystemTime(now);

    await expect(connectTestCall(call.conversationId)).resolves.toMatchObject({ status: "ready" });

    const [started, paused] = await Promise.all([
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: other.id } }),
    ]);

    expect(readBlockPayload(started).timing).toMatchObject({
      activeAt: now.toISOString(),
      elapsedMs: 0,
    });

    expect(readBlockPayload(paused).timing).toMatchObject({ activeAt: null, elapsedMs: 20_000 });
    expect(createLiveCallSession).toHaveBeenCalledOnce();
  });

  it.each(["lessons", "challenge"] as const)(
    "refuses a waiting call before scenario generation or session opening (%s)",
    async (reason) => {
      const { block, renting, session, user } = await waitingCheckpointFixture({ reason });
      const waiting = { reason, status: "earlierFirst" };

      await expect(
        startLanguageConversation({ blockId: block.id, kind: "checkpoint" }),
      ).resolves.toStrictEqual(waiting);

      await expect(openLanguageCheckpointCall(block.id)).resolves.toStrictEqual(waiting);

      expect(generateConversationScenario).not.toHaveBeenCalled();

      await expect(
        prisma.languageConversation.count({ where: { studyBlockId: block.id } }),
      ).resolves.toBe(0);

      await expect(
        prisma.conversationScenario.count({ where: { chapterId: renting.id, level: "B1" } }),
      ).resolves.toBe(0);

      await expect(
        prisma.learningEvent.count({ where: { kind: "session", userId: user.id } }),
      ).resolves.toBe(0);

      await expect(
        prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
      ).resolves.toStrictEqual(session);

      await expect(
        prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
      ).resolves.toStrictEqual(block);
    },
  );

  it("checks earlier work even when a checkpoint's call was already created", async () => {
    const { block } = await reachedCheckpointFixture({ speaking: 1 });
    const opened = await startLanguageConversation({ blockId: block.id, kind: "checkpoint" });

    expect(opened.status).toBe("ready");

    const conversation = await prisma.languageConversation.findUniqueOrThrow({
      where: { studyBlockId: block.id },
    });

    const shifted = await prisma.studySessionBlock.update({
      data: { position: 1 },
      where: { id: block.id },
    });

    await studySessionBlockFixture({ position: 0, sessionId: block.sessionId });
    const session = await prisma.studySession.findUniqueOrThrow({ where: { id: block.sessionId } });
    const waiting = { reason: "lessons", status: "earlierFirst" };

    await expect(
      startLanguageConversation({ blockId: block.id, kind: "checkpoint" }),
    ).resolves.toStrictEqual(waiting);

    await expect(openLanguageCheckpointCall(block.id)).resolves.toStrictEqual(waiting);

    expect(generateConversationScenario).not.toHaveBeenCalled();

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { studyBlockId: block.id } }),
    ).resolves.toStrictEqual(conversation);

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: session.id } }),
    ).resolves.toStrictEqual(session);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toStrictEqual(shifted);
  });

  it("opens the shared block before writing the call once earlier lessons are skipped", async () => {
    const { block, earlier } = await waitingCheckpointFixture({ reason: "lessons" });

    await prisma.studySessionBlock.update({
      data: { status: "skipped" },
      where: { id: earlier.id },
    });

    const scenario = vi.mocked(generateConversationScenario).getMockImplementation();

    vi.mocked(generateConversationScenario).mockImplementationOnce(async (...args) => {
      const started = await prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } });

      const session = await prisma.studySession.findUniqueOrThrow({
        where: { id: block.sessionId },
      });

      expect(started).toMatchObject({ startedAt: expect.any(Date), status: "active" });
      expect(session).toMatchObject({ startedAt: expect.any(Date), status: "active" });

      if (!scenario) {
        throw new Error("Expected the external scenario boundary");
      }

      return scenario(...args);
    });

    await expect(
      startLanguageConversation({ blockId: block.id, kind: "checkpoint" }),
    ).resolves.toMatchObject({ status: "ready" });

    expect(generateConversationScenario).toHaveBeenCalledOnce();
  });

  it("opening a written checkpoint scenario issues no writes or generation", async () => {
    const { block } = await reachedCheckpointFixture({ speaking: 1 });

    const opened = await countDatabaseStatements(() => openLanguageCheckpointCall(block.id));

    expect(opened.writes).toBe(0);
    expect(opened.result).toMatchObject({ dailyLimitReached: false, status: "notStarted" });
    expect(generateConversationScenario).not.toHaveBeenCalled();

    await expect(
      prisma.languageConversation.count({ where: { studyBlockId: block.id } }),
    ).resolves.toBe(0);

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toStrictEqual(block);
  });

  it("says a pending checkpoint opened past today's study time can't start today, as its Start does", async () => {
    const { block, user } = await reachedCheckpointFixture({ speaking: 1 });

    const unlimited = await countDatabaseStatements(() => openLanguageCheckpointCall(block.id));
    expect(unlimited.result).toMatchObject({ dailyLimitReached: false, status: "notStarted" });

    await Promise.all([
      learningProfileFixture({ dailyLimitMinutes: 30, userId: user.id }),
      dailyProgressFixtureMany([
        { date: toUTCMidnight(new Date()), timeSpentSeconds: 30 * 60, userId: user.id },
      ]),
    ]);

    const opened = await countDatabaseStatements(() => openLanguageCheckpointCall(block.id));

    expect(opened.writes).toBe(0);
    expect(opened.statements).toBe(unlimited.statements + 1);

    expect(opened.result).toMatchObject({
      dailyLimitReached: true,
      intro: { title: RENTING_SCENARIO.title },
      status: "notStarted",
    });

    await expect(
      startLanguageConversation({ blockId: block.id, kind: "checkpoint" }),
    ).resolves.toStrictEqual({ status: "dailyLimitReached" });

    await expect(
      prisma.languageConversation.count({ where: { studyBlockId: block.id } }),
    ).resolves.toBe(0);

    await prisma.studySessionBlock.update({ data: { status: "active" }, where: { id: block.id } });

    await expect(openLanguageCheckpointCall(block.id)).resolves.toMatchObject({
      dailyLimitReached: false,
      status: "notStarted",
    });
  });

  it("opens a checkpoint's call from its unit's written call without a model", async () => {
    const { block } = await reachedCheckpointFixture({ speaking: 1 });

    const first = await openLanguageCheckpointCall(block.id);
    const again = await openLanguageCheckpointCall(block.id);

    expect(first).toMatchObject({
      intro: { level: "A2", title: RENTING_SCENARIO.title },
      status: "notStarted",
    });

    expect(again).toStrictEqual(first);
    expect(generateConversationScenario).not.toHaveBeenCalled();

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: block.id } }),
    ).resolves.toStrictEqual(block);

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: block.sessionId } }),
    ).resolves.toMatchObject({ startSnapshot: null, startedAt: null, status: "planned" });

    const started = await startLanguageConversation({ blockId: block.id, kind: "checkpoint" });

    if (started.status !== "ready") {
      throw new Error(`Expected the call to start, got ${started.status}`);
    }

    await expect(openLanguageCheckpointCall(block.id)).resolves.toStrictEqual({
      conversationId: started.conversationId,
      status: "ready",
    });

    await expect(
      startLanguageConversation({ blockId: block.id, kind: "checkpoint" }),
    ).resolves.toStrictEqual(started);

    await expect(
      prisma.languageConversation.count({ where: { studyBlockId: block.id } }),
    ).resolves.toBe(1);
  });

  it("leaves a checkpoint preparing when its call isn't written, and starting it writes the call", async () => {
    const { block, renting } = await reachedCheckpointFixture({ speaking: 2 });

    await expect(openLanguageCheckpointCall(block.id)).resolves.toStrictEqual({
      status: "preparing",
      unitTitle: renting.title,
    });

    expect(generateConversationScenario).not.toHaveBeenCalled();

    await expect(
      prisma.languageConversation.count({ where: { studyBlockId: block.id } }),
    ).resolves.toBe(0);

    const started = await startLanguageConversation({ blockId: block.id, kind: "checkpoint" });

    if (started.status !== "ready") {
      throw new Error(`Expected the call to start, got ${started.status}`);
    }

    expect(generateConversationScenario).toHaveBeenCalledOnce();

    await expect(openLanguageCheckpointCall(block.id)).resolves.toStrictEqual({
      conversationId: started.conversationId,
      status: "ready",
    });
  });

  it("writes the next checkpoint's call ahead at the learner's level, once", async () => {
    const { block, goal, renting, user } = await reachedCheckpointFixture({ speaking: 2 });

    await prepareCheckpointCall({ goalId: goal.id, userId: user.id });
    await prepareCheckpointCall({ goalId: goal.id, userId: user.id });

    expect(generateConversationScenario).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({ level: "B1", unitTitle: renting.title }),
    );

    const opened = await openLanguageCheckpointCall(block.id);

    expect(opened.status).toBe("notStarted");
    expect(generateConversationScenario).toHaveBeenCalledOnce();

    await startLanguageConversation({ blockId: block.id, kind: "checkpoint" });

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { studyBlockId: block.id } }),
    ).resolves.toMatchObject({ level: "B1", titleSnapshot: B1_SCENARIO.title });
  });

  it("writes nothing ahead when the unit's call is written or the goal has no checkpoint call", async () => {
    const [written, other] = await Promise.all([
      reachedCheckpointFixture({ speaking: 1 }),
      userFixture(),
    ]);

    const otherGoal = await goalFixture({ userId: other.id });

    await Promise.all([
      prepareCheckpointCall({ goalId: written.goal.id, userId: written.user.id }),
      prepareCheckpointCall({ goalId: otherGoal.id, userId: other.id }),
    ]);

    expect(generateConversationScenario).not.toHaveBeenCalled();
  });

  it("keeps another learner's checkpoint closed", async () => {
    const { block } = await reachedCheckpointFixture({ speaking: 1 });
    const stranger = await userFixture();
    mockSession(stranger.id);

    await expect(openLanguageCheckpointCall(block.id)).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(
      startLanguageConversation({ blockId: block.id, kind: "checkpoint" }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });
});

async function upcomingCallFixture({ speaking }: { speaking: number }) {
  const setup = await languageGoalFixture();
  const { checkpoints, user } = setup;
  const boss = checkpoints[1];

  if (!boss) {
    throw new Error("Expected the renting unit's checkpoint");
  }

  await Promise.all([
    prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    }),
    prisma.languageSkillLevel.create({
      data: {
        language: "en",
        score: speaking,
        skill: "speaking",
        startScore: speaking,
        userId: user.id,
      },
    }),
  ]);

  mockSession(user.id);
  return { ...setup, boss };
}

async function introOf(planItemId: string) {
  const result = await getChallenge({ input: {}, planItemId });

  if (result.status !== "ready") {
    throw new Error(`Expected the challenge, got ${result.status}`);
  }

  return result.challenge;
}

describe("a language checkpoint's challenge intro", () => {
  it("describes the unit's call before its day, never a duel of questions", async () => {
    const { boss } = await upcomingCallFixture({ speaking: 1 });
    const intro = await introOf(boss.id);

    expect(intro).toMatchObject({
      call: {
        goals: RENTING_SCENARIO.objectives,
        level: "A2",
        minutes: 1,
        targetLanguage: "en",
        title: RENTING_SCENARIO.title,
      },
      passMark: 3,
      questions: 0,
      recordings: 0,
      status: "upcoming",
      topics: [],
    });

    expect(generateConversationScenario).not.toHaveBeenCalled();
  });

  it("describes the call its block already opened, even after the learner's level changed", async () => {
    const { block, boss, user } = await reachedCheckpointFixture({ speaking: 1 });

    await expect(
      startLanguageConversation({ blockId: block.id, kind: "checkpoint" }),
    ).resolves.toMatchObject({ status: "ready" });

    await prisma.languageSkillLevel.updateMany({
      data: { score: 2 },
      where: { skill: "speaking", userId: user.id },
    });

    const intro = await introOf(boss.id);

    expect(intro).toMatchObject({
      call: {
        goals: RENTING_SCENARIO.objectives,
        level: "A2",
        minutes: 1,
        targetLanguage: "en",
        title: RENTING_SCENARIO.title,
      },
      passMark: 3,
    });
  });

  it("says only the call's length and level while its call isn't written at the learner's level", async () => {
    const { boss } = await upcomingCallFixture({ speaking: 2 });
    const intro = await introOf(boss.id);

    expect(intro).toMatchObject({
      call: { goals: null, level: "B1", minutes: 2, targetLanguage: "en", title: null },
      passMark: null,
      questions: 0,
    });

    expect(generateConversationScenario).not.toHaveBeenCalled();
  });
});
