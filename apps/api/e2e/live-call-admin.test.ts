import { request } from "@playwright/test";
import { mockConditionsSchema } from "@zoonk/core/exams/mocks/contract";
import {
  liveCallAdmissionInputSchema,
  liveCallAdmissionResponseSchema,
  liveCallCloseAllResponseSchema,
} from "@zoonk/core/language/conversations/admission-contract";
import { languageConversationSetupSchema } from "@zoonk/core/language/conversations/contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import { LIVE_CALL_SDP_OFFER, languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { createBearerAdmin, createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

/** A structurally valid WebRTC offer: the no-spend provider answers it. */
const OFFER = { sdp: LIVE_CALL_SDP_OFFER };

const ADMISSION = "/v1/live-calls/admission";
const CLOSE_ALL = "/v1/live-calls/close-all";
const SETTING = { admission: "all" as const, freeDailyBudgetMicros: 100_000_000 };

/** Playwright's dedicated dependent project isolates this global setting from learner tests. */
test("admin controls use API credentials, require the admin role and disable admission before closing", async () => {
  const baseURL = process.env.E2E_BASE_URL ?? "";

  const [anonymous, learner, admin] = await Promise.all([
    request.newContext({ baseURL }),
    createBearerLearner({ baseURL, prefix: "live-admin-learner" }),
    createBearerAdmin({ baseURL, prefix: "live-admin" }),
  ]);

  try {
    const [anonymousRead, anonymousWrite, anonymousClose, deniedRead, deniedWrite, deniedClose] =
      await Promise.all([
        anonymous.get(ADMISSION),
        anonymous.post(ADMISSION, { data: SETTING }),
        anonymous.post(CLOSE_ALL),
        learner.api.get(ADMISSION),
        learner.api.post(ADMISSION, { data: SETTING }),
        learner.api.post(CLOSE_ALL),
      ]);

    expect([
      anonymousRead.status(),
      anonymousWrite.status(),
      anonymousClose.status(),
    ]).toStrictEqual([401, 401, 401]);

    expect([deniedRead.status(), deniedWrite.status(), deniedClose.status()]).toStrictEqual([
      403, 403, 403,
    ]);

    const saved = await readBody({
      response: await admin.post(ADMISSION, { data: SETTING }),
      schema: liveCallAdmissionInputSchema,
      status: 200,
    });

    expect(saved).toStrictEqual(SETTING);
    const read = await admin.get(ADMISSION);
    expect(read.headers()["cache-control"]).toBe("no-store");

    const view = await readBody({
      response: read,
      schema: liveCallAdmissionResponseSchema,
      status: 200,
    });

    expect(view).toMatchObject({ providerAvailable: true, setting: SETTING });

    const { renting } = await languageGoalFixture({ userId: learner.userId });

    const started = await learner.api.post("/v1/language-conversations", {
      data: { chapterId: renting.id, kind: "practice", minutes: 1 },
    });

    expect(started.status()).toBe(201);
    const { conversationId } = (await started.json()) as { conversationId: string };
    const path = `/v1/language-conversations/${conversationId}/connections`;

    await readBody({
      response: await admin.post(ADMISSION, { data: { ...SETTING, admission: "staff" } }),
      schema: liveCallAdmissionInputSchema,
      status: 200,
    });

    const paused = await learner.api.post(path);
    expect(paused.status()).toBe(503);
    await expect(paused.json()).resolves.toMatchObject({ error: { code: "CALLS_PAUSED" } });

    const [speakingGoal] = await Promise.all([
      goalFixture({
        kind: "language",
        language: "pt",
        targetLanguage: "es",
        title: "DELE B2",
        userId: learner.userId,
      }),
      prisma.subscription.create({
        data: { plan: "plus", provider: "zoonk", referenceId: learner.userId, status: "active" },
      }),
    ]);

    const pausedTask = await learner.api.post("/v1/language-conversations", {
      data: { goalId: speakingGoal.id, kind: "examSpeaking", task: "t1" },
    });

    expect(pausedTask.status()).toBe(503);
    await expect(pausedTask.json()).resolves.toMatchObject({ error: { code: "CALLS_PAUSED" } });
    expect(await prisma.languageConversation.count({ where: { goalId: speakingGoal.id } })).toBe(0);

    const mockGoal = await goalFixture({
      kind: "language",
      language: "pt",
      targetLanguage: "en",
      title: "IELTS",
      userId: learner.userId,
    });

    const pausedSpeakingMock = await learner.api.post("/v1/language-conversations", {
      data: { goalId: mockGoal.id, kind: "speakingMock" },
    });

    expect(pausedSpeakingMock.status()).toBe(503);

    await expect(pausedSpeakingMock.json()).resolves.toMatchObject({
      error: { code: "CALLS_PAUSED" },
    });

    expect(await prisma.languageConversation.count({ where: { goalId: mockGoal.id } })).toBe(0);

    const conditions = mockConditionsSchema.parse({
      day: null,
      fullLength: true,
      scoring: "raw",
      sections: [
        {
          itemIds: [],
          kind: "speaking",
          minutes: 20,
          name: "Expresión e interacción orales",
          questions: 0,
          routing: null,
        },
      ],
      startTime: null,
      timeZone: "UTC",
    });

    const activeMock = await prisma.mockExam.create({
      data: {
        conditions,
        goalId: speakingGoal.id,
        sectionStartedAt: new Date(),
        userId: learner.userId,
      },
    });

    const pausedPaper = await learner.api.post(`/v1/mocks/${activeMock.id}/speaking`);
    expect(pausedPaper.status()).toBe(503);
    await expect(pausedPaper.json()).resolves.toMatchObject({ error: { code: "CALLS_PAUSED" } });
    const keptMock = await prisma.mockExam.findUniqueOrThrow({ where: { id: activeMock.id } });
    expect(keptMock.conditions).toStrictEqual(conditions);
    expect(await prisma.languageConversation.count({ where: { goalId: speakingGoal.id } })).toBe(0);
    await admin.post(ADMISSION, { data: SETTING });

    const setup = await readBody({
      response: await learner.api.post(path),
      schema: languageConversationSetupSchema,
      status: 201,
    });

    const answered = await learner.api.post(setup.sessionUrl, { data: OFFER });
    expect(answered.status()).toBe(201);

    const active = await readBody({
      response: await admin.get(ADMISSION),
      schema: liveCallAdmissionResponseSchema,
      status: 200,
    });

    expect(active.connections).toContainEqual(
      expect.objectContaining({ id: setup.connectionId, state: "active" }),
    );

    await expect(async () => {
      await readBody({
        response: await admin.post(CLOSE_ALL),
        schema: liveCallCloseAllResponseSchema,
        status: 200,
      });

      const connection = await prisma.liveCallConnection.findUniqueOrThrow({
        where: { id: setup.connectionId },
      });

      expect(connection.state).toBe("closed");
    }).toPass();

    const disabled = await readBody({
      response: await admin.get(ADMISSION),
      schema: liveCallAdmissionResponseSchema,
      status: 200,
    });

    expect(disabled.setting.admission).toBe("off");

    const completion = await learner.api.post(
      `/v1/language-conversations/${conversationId}/completions`,
      {
        data: {
          connectionId: setup.connectionId,
          spokenSeconds: 0,
          timeZone: "UTC",
          turns: [],
          usedHelp: false,
        },
      },
    );

    expect(completion.status()).toBe(409);

    await expect(completion.json()).resolves.toMatchObject({
      error: { code: "CONVERSATION_ENDED" },
    });
  } finally {
    await admin.post(ADMISSION, { data: SETTING });
    await Promise.all([anonymous.dispose(), learner.api.dispose(), admin.dispose()]);
  }
});
