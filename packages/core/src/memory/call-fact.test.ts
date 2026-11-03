import { createLiveCallSession } from "@zoonk/ai/tasks/language/live-call-session";
import { type LanguageConversation, prisma } from "@zoonk/db";
import { planItemFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { memoryFactFixture } from "@zoonk/testing/fixtures/memory";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { MS_PER_DAY } from "@zoonk/utils/date";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanupTestCalls, connectTestCall } from "../_test-utils/connect-test-call";
import { freezeClock } from "../_test-utils/frozen-clock";
import { mockSession } from "../_test-utils/mock-session";
import {
  anotherLiveConversation,
  liveCallFixture,
} from "../language/conversations/_test-utils/live-call-fixture";
import { getLanguageConversation } from "../language/conversations/get-language-conversation";
import { startLanguageConversation } from "../language/conversations/start-language-conversation";
import { findFactForCall } from "./call-fact";
import { deleteMemoryFact } from "./delete-memory-fact";
import { updateMemorySettings } from "./update-memory-settings";

function daysFromNow(days: number) {
  return new Date(Date.now() + days * MS_PER_DAY);
}

async function pastCall({
  days,
  kind = "practice",
  memoryFactId = null,
  userId,
}: {
  days: number;
  kind?: LanguageConversation["kind"];
  memoryFactId?: string | null;
  userId: string;
}) {
  const call = await anotherLiveConversation({ kind, userId });

  await prisma.languageConversation.update({
    data: { createdAt: daysFromNow(-days), memoryFactId },
    where: { id: call.id },
  });
}

function findFact(userId: string, now = new Date()) {
  return findFactForCall({ now, userId });
}

function lastInstructions() {
  return vi.mocked(createLiveCallSession).mock.lastCall?.[0].instructions;
}

describe(findFactForCall, () => {
  it("brings up only a current fact the learner said about their own life", async () => {
    const { id: userId } = await userFixture();

    await Promise.all([
      memoryFactFixture({ category: "preferences", statement: "Gosta de futebol", userId }),
      memoryFactFixture({ category: "learning", statement: "Confunde in e on", userId }),
      memoryFactFixture({
        category: "routine",
        origin: "noticed",
        statement: "Estuda tarde",
        userId,
      }),
      memoryFactFixture({
        category: "context",
        sensitive: true,
        statement: "Tem um exame médico",
        userId,
      }),
      memoryFactFixture({
        category: "goals",
        expiresAt: daysFromNow(-1),
        statement: "Viagem a Roma",
        userId,
      }),
      memoryFactFixture({
        category: "background",
        statement: "Tem um gato",
        status: "deleted",
        userId,
      }),
    ]);

    await expect(findFact(userId)).resolves.toBeNull();

    const nurse = await memoryFactFixture({
      category: "background",
      statement: "Trabalha como enfermeira",
      userId,
    });

    await expect(findFact(userId)).resolves.toBe(nurse.id);
  });

  it("brings up the newest fact, or the soonest dated one when there is one", async () => {
    const { id: userId } = await userFixture();

    await memoryFactFixture({ createdAt: daysFromNow(-9), statement: "Trabalha à noite", userId });
    const newest = await memoryFactFixture({ statement: "Tem dois filhos", userId });

    await expect(findFact(userId)).resolves.toBe(newest.id);

    const [interview] = await Promise.all([
      memoryFactFixture({
        category: "context",
        createdAt: daysFromNow(-5),
        expiresAt: daysFromNow(4),
        statement: "Tem uma entrevista de emprego na sexta",
        userId,
      }),
      memoryFactFixture({
        createdAt: daysFromNow(-1),
        expiresAt: daysFromNow(90),
        statement: "Vai se mudar para Toronto em fevereiro",
        userId,
      }),
    ]);

    await expect(findFact(userId)).resolves.toBe(interview.id);
  });

  it("brings up nothing in the practice call after one that carried a fact", async () => {
    const { id: userId } = await userFixture();
    const nurse = await memoryFactFixture({ statement: "Trabalha como enfermeira", userId });
    await memoryFactFixture({ createdAt: daysFromNow(-30), statement: "Tem dois filhos", userId });

    await pastCall({ days: 2, memoryFactId: nurse.id, userId });
    await pastCall({ days: 1, kind: "checkpoint", userId });

    await expect(findFact(userId)).resolves.toBeNull();
  });

  it("rests a fact for 14 days after a call carried it", async () => {
    const { id: userId } = await userFixture();
    const nurse = await memoryFactFixture({ statement: "Trabalha como enfermeira", userId });

    await pastCall({ days: 13, memoryFactId: nurse.id, userId });
    await pastCall({ days: 1, userId });

    await expect(findFact(userId)).resolves.toBeNull();
    await expect(findFact(userId, daysFromNow(2))).resolves.toBe(nurse.id);
  });

  it("brings up nothing while memory is off", async () => {
    const { id: userId } = await userFixture();
    await memoryFactFixture({ statement: "Trabalha como enfermeira", userId });
    await learningProfileFixture({ memoryEnabled: false, userId });

    await expect(findFact(userId)).resolves.toBeNull();
  });
});

describe("a call's memory note", () => {
  afterEach(cleanupTestCalls);

  it("gives a practice call's character the fact picked at its start, on every connection", async () => {
    const { renting, user } = await languageGoalFixture();
    mockSession(user.id);

    const move = await memoryFactFixture({
      statement: "Vai se mudar para Toronto em fevereiro",
      userId: user.id,
    });

    const started = await startLanguageConversation({
      chapterId: renting.id,
      kind: "practice",
      minutes: 2,
    });

    const conversationId = started.status === "ready" ? started.conversationId : "";

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: conversationId } }),
    ).resolves.toMatchObject({ memoryFactId: move.id });

    const view = await getLanguageConversation(conversationId);
    expect(view.status === "ready" && "memoryFactId" in view.conversation).toBe(false);

    await connectTestCall(conversationId);
    expect(lastInstructions()).toContain('"Vai se mudar para Toronto em fevereiro"');

    await memoryFactFixture({ statement: "Tem uma entrevista na sexta", userId: user.id });
    await connectTestCall(conversationId);

    expect(lastInstructions()).toContain('"Vai se mudar para Toronto em fevereiro"');
    expect(lastInstructions()).not.toContain("Tem uma entrevista na sexta");
  });

  it("gives a checkpoint call no fact", async () => {
    const { goal, plan, user } = await languageGoalFixture();
    mockSession(user.id);

    await Promise.all([
      memoryFactFixture({ statement: "Vai se mudar para Toronto em fevereiro", userId: user.id }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
      }),
    ]);

    const [boss, session] = await Promise.all([
      planItemFixture({ kind: "boss", phase: 1, planId: plan.id, position: 10 }),
      studySessionFixture({ goalId: goal.id, userId: user.id }),
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

    const started = await startLanguageConversation({ blockId: block.id, kind: "checkpoint" });
    const conversationId = started.status === "ready" ? started.conversationId : "";

    await expect(
      prisma.languageConversation.findUniqueOrThrow({ where: { id: conversationId } }),
    ).resolves.toMatchObject({ kind: "checkpoint", memoryFactId: null });

    await connectTestCall(conversationId);
    expect(lastInstructions()).not.toContain("Toronto");
  });

  it.each([
    {
      change: async (factId: string) => {
        await deleteMemoryFact(factId);
      },
      name: "the learner deletes the fact",
    },
    {
      change: async () => {
        vi.setSystemTime(daysFromNow(2));
      },
      name: "the fact expires",
    },
    {
      change: async () => {
        await updateMemorySettings({ enabled: false });
      },
      name: "the learner switches memory off",
    },
  ])("leaves the note out when $name before the call connects", async ({ change }) => {
    freezeClock();

    const { conversation, user } = await liveCallFixture();
    mockSession(user.id);

    const trip = await memoryFactFixture({
      category: "context",
      expiresAt: daysFromNow(1),
      statement: "Vai viajar para Londres amanhã",
      userId: user.id,
    });

    await prisma.languageConversation.update({
      data: { memoryFactId: trip.id },
      where: { id: conversation.id },
    });

    await change(trip.id);
    await connectTestCall(conversation.id);

    expect(lastInstructions()).toContain("You are Linda");
    expect(lastInstructions()).not.toContain("Londres");
  });
});
