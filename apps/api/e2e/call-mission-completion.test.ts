import { randomUUID } from "node:crypto";
import { completedLanguageConversationSchema } from "@zoonk/core/language/conversations/contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { RENTING_SCENARIO, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { studySessionFixture } from "@zoonk/testing/fixtures/study-sessions";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

test("a completed call's HTTP retry returns its mission moment and pays the bonus once", async () => {
  const learner = await createBearerLearner({
    baseURL: process.env.E2E_BASE_URL ?? "",
    prefix: "call-mission",
  });

  try {
    const { goal, renting } = await languageGoalFixture({ userId: learner.userId });
    // A persisted completed call exercises the transport and recovery without a model or live provider.
    const [call, day] = await Promise.all([
      prisma.languageConversation.create({
        data: {
          chapterId: renting.id,
          endedAt: new Date(),
          goalId: goal.id,
          kind: "practice",
          language: "en",
          level: "A2",
          minutes: 2,
          scenario: RENTING_SCENARIO,
          spokenSeconds: 30,
          status: "completed",
          targetLanguage: "en",
          titleSnapshot: "A renting call",
          userId: learner.userId,
        },
      }),
      studySessionFixture({
        goalId: goal.id,
        missions: {
          picks: [{ anchor: { chapterId: renting.id }, kind: "call", total: 1 }],
          version: 1,
        },
        userId: learner.userId,
      }),
    ]);

    const usage = await prisma.usageRecord.create({
      data: { kind: "conversation", seconds: 30, targetId: call.id, userId: learner.userId },
    });

    const connection = await prisma.liveCallConnection.create({
      data: {
        attemptNumber: 1,
        closedAt: new Date(),
        conversationId: call.id,
        costConfidence: "confirmed",
        deadlineAt: new Date(),
        generation: 1,
        heldSeconds: 0,
        liabilityMicros: 0,
        requestId: randomUUID(),
        reservedMicros: 0,
        state: "closed",
        usageRecordId: usage.id,
        userId: learner.userId,
      },
    });

    const path = `/v1/language-conversations/${call.id}/completions`;

    const data = {
      connectionId: connection.id,
      spokenSeconds: 30,
      timeZone: "UTC",
      turns: [],
      usedHelp: false,
    };

    const first = await readBody({
      response: await learner.api.post(path, { data }),
      schema: completedLanguageConversationSchema,
      status: 200,
    });

    expect(first.missionMoment).toMatchObject({
      completed: ["call"],
      fullMeal: { bonus: 50, paid: true },
      missions: [{ kind: "call", status: "done" }],
    });

    const replay = await readBody({
      response: await learner.api.post(path, { data }),
      schema: completedLanguageConversationSchema,
      status: 200,
    });

    expect(replay).toStrictEqual(first);

    await expect(
      prisma.studySession.findUniqueOrThrow({ where: { id: day.id } }),
    ).resolves.toMatchObject({ fullMealAt: expect.any(Date) });

    await expect(
      prisma.userProgress.findUniqueOrThrow({ where: { userId: learner.userId } }),
    ).resolves.toMatchObject({ totalBrainPower: 50n });
  } finally {
    await learner.api.dispose();
  }
});
