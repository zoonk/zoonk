import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { getAlphabetIdentityKey } from "@zoonk/core/library/language/alphabet-identity";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture } from "@zoonk/testing/fixtures/goals";
import {
  RENTING_SCENARIO,
  alphabetLessonFixture,
  languageGoalFixture,
} from "@zoonk/testing/fixtures/language";
import { usageRecordsFixture } from "@zoonk/testing/fixtures/usage";
import { createAuthenticatedApiContext } from "./helpers/auth";

const LEVELS = ["A1", "A2", "B1", "B2", "C1"] as const;
const FREE_DAILY_CONVERSATIONS = 3;
const ELEVEN_MINUTES_MS = 660_000;

/** A level test bank for Portuguese speakers learning English, so no model writes one here. */
async function ensureLevelTestBank() {
  const questions = LEVELS.flatMap((level) =>
    (["reading", "listening"] as const).flatMap((skill) =>
      [0, 1].map((index) => ({
        answerIndex: 0,
        id: `${skill}-${level}-${index}`,
        level,
        options: ["Certa", "Errada 1", "Errada 2", "Errada 3"],
        passage: `A ${skill} passage at ${level}.`,
        question: "O que diz o texto?",
        skill,
      })),
    ),
  );

  const content = {
    questions,
    speaking: LEVELS.map((level) => ({
      level,
      sentence: `A sentence at ${level}.`,
      translation: "Uma frase.",
    })),
  };

  await prisma.languageLevelTest.upsert({
    create: {
      content,
      language: "pt",
      model: "test",
      promptVersion: "test",
      runId: "test",
      targetLanguage: "en",
    },
    update: { content },
    where: { languagePair: { language: "pt", targetLanguage: "en" } },
  });
}

test.describe("Language goal API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication", async () => {
    const apiContext = await request.newContext({ baseURL });

    const [progress, conversation, pattern] = await Promise.all([
      apiContext.get(`/v1/goals/${randomUUID()}/language-progress`),
      apiContext.post("/v1/language-conversations", {
        data: { chapterId: randomUUID(), kind: "practice", minutes: 2 },
      }),
      apiContext.get(`/v1/mistake-patterns/${randomUUID()}`),
    ]);

    expect([progress.status(), conversation.status(), pattern.status()]).toStrictEqual([
      401, 401, 401,
    ]);

    await apiContext.dispose();
  });

  test("returns a language goal's progress, Today cards and units, and nothing for other goals", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "language-views",
    });

    const { goal, renting } = await languageGoalFixture({ userId: user.id });
    const other = await goalFixture({ userId: user.id });

    const [progress, today, unit, notLanguage, badUnit, units] = await Promise.all([
      apiContext.get(`/v1/goals/${goal.id}/language-progress`),
      apiContext.get(`/v1/goals/${goal.id}/language-today`),
      apiContext.get(`/v1/language-units/${renting.id}`),
      apiContext.get(`/v1/goals/${other.id}/language-progress`),
      apiContext.get("/v1/language-units/not-a-uuid"),
      apiContext.get(`/v1/goals/${goal.id}/language-units`),
    ]);

    expect(progress.status()).toBe(200);

    expect(await progress.json()).toMatchObject({
      currentUnit: { position: 1, units: 2 },
      goal: { id: goal.id, targetLanguage: "en" },
      levels: [{ label: "A2", skill: "reading", trend: "same" }, {}, {}, {}],
      recent: { conversations: 0 },
      speakingMock: null,
      target: { label: "B1+" },
      wordsKnown: 0,
    });

    expect(await today.json()).toMatchObject({ newCanDo: null, pattern: null });

    expect(await unit.json()).toMatchObject({
      conversation: { character: { name: "Linda" } },
      goalId: goal.id,
    });

    expect(notLanguage.status()).toBe(422);
    const notLanguageBody = await notLanguage.json();
    expect(notLanguageBody.error.code).toBe("NOT_LANGUAGE");
    expect(badUnit.status()).toBe(400);

    const unitsBody = await units.json();

    expect(unitsBody.units.map((item: { position: number }) => item.position)).toStrictEqual([
      1, 2,
    ]);

    await apiContext.dispose();
  });

  test("lists a new script's alphabet lesson and skips it for a learner who reads it", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "language-alphabet",
    });

    const [{ goal }, lesson, other] = await Promise.all([
      languageGoalFixture({ userId: user.id }),
      alphabetLessonFixture({ identityKey: getAlphabetIdentityKey("ru"), targetLanguage: "ru" }),
      goalFixture({ userId: user.id }),
    ]);

    await prisma.goal.update({ data: { targetLanguage: "ru" }, where: { id: goal.id } });

    const alphabetOf = async (): Promise<unknown> => {
      const units = await apiContext.get(`/v1/goals/${goal.id}/language-units`);
      const body: { alphabet: unknown } = await units.json();
      return body.alphabet;
    };

    expect(await alphabetOf()).toStrictEqual({
      canDo: "Ler e dizer as primeiras letras do cirílico",
      lessonId: lesson.id,
      minutes: 5,
      pending: true,
      title: "Seu primeiro cirílico",
    });

    const anonymous = await request.newContext({ baseURL });

    const [skipped, again, notLanguage, missing, invalid, unauthorized] = await Promise.all([
      apiContext.post(`/v1/goals/${goal.id}/alphabet-skips`),
      apiContext.post(`/v1/goals/${goal.id}/alphabet-skips`),
      apiContext.post(`/v1/goals/${other.id}/alphabet-skips`),
      apiContext.post(`/v1/goals/${randomUUID()}/alphabet-skips`),
      apiContext.post("/v1/goals/not-a-uuid/alphabet-skips"),
      anonymous.post(`/v1/goals/${goal.id}/alphabet-skips`),
    ]);

    expect(
      [skipped, again, notLanguage, missing, invalid, unauthorized].map((response) =>
        response.status(),
      ),
    ).toStrictEqual([204, 204, 422, 404, 400, 401]);

    expect(await alphabetOf()).toMatchObject({ lessonId: lesson.id, pending: false });

    await Promise.all([apiContext.dispose(), anonymous.dispose()]);
  });

  test("names the TOEFL as the exam of a goal's speaking mock and of a mock's result", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "language-toefl-mock",
    });

    const { goal } = await languageGoalFixture({ userId: user.id });

    await prisma.goal.update({
      data: { details: { level: "A2", reason: "Preciso do TOEFL para o mestrado" } },
      where: { id: goal.id },
    });

    const progress = await apiContext.get(`/v1/goals/${goal.id}/language-progress`);
    expect(await progress.json()).toMatchObject({ speakingMock: "toefl" });

    const overall = { bandHigh: 4.5, bandLow: 4 };

    const mock = await prisma.languageConversation.create({
      data: {
        endedAt: new Date(),
        feedback: {
          criteria: ["repetition", "elaboration", "grammar", "vocabulary", "delivery"].map(
            (criterion) => ({ ...overall, criterion, evidence: "Evidência.", tip: "Dica." }),
          ),
          exam: "toefl",
          focus: "elaboration",
          kind: "speakingMock",
          overall,
        },
        goalId: goal.id,
        kind: "speakingMock",
        language: "pt",
        level: "A2",
        minutes: 5,
        scenario: { ...RENTING_SCENARIO, exam: "toefl" },
        spokenSeconds: 200,
        status: "completed",
        targetLanguage: "en",
        titleSnapshot: RENTING_SCENARIO.title,
        userId: user.id,
      },
    });

    const view = await apiContext.get(`/v1/language-conversations/${mock.id}`);

    expect(await view.json()).toMatchObject({
      exam: "toefl",
      kind: "speakingMock",
      result: { feedback: { exam: "toefl", focus: "elaboration", overall } },
    });

    await prisma.goal.update({ data: { kind: "exam", title: "TOEFL" }, where: { id: goal.id } });

    const exam = await apiContext.get(`/v1/goals/${goal.id}/exam?timeZone=UTC`);
    expect(await exam.json()).toMatchObject({ speakingMock: "toefl" });

    await apiContext.dispose();
  });

  test("starts a practice call, keeps it private and finishes it once", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "language-call",
    });

    const { renting } = await languageGoalFixture({ userId: user.id });

    const started = await apiContext.post("/v1/language-conversations", {
      data: { chapterId: renting.id, kind: "practice", minutes: 2 },
    });

    expect(started.status()).toBe(201);
    const { conversationId } = await started.json();
    expect(started.headers().location).toBe(`/v1/language-conversations/${conversationId}`);

    const view = await apiContext.get(`/v1/language-conversations/${conversationId}`);

    expect(await view.json()).toMatchObject({
      character: RENTING_SCENARIO.character,
      exam: null,
      kind: "practice",
      minutes: 2,
      result: null,
      status: "ready",
    });

    const { apiContext: stranger } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "language-stranger",
    });

    const turns = [{ speaker: "character", text: RENTING_SCENARIO.openingLine }];
    const checks = `/v1/language-conversations/${conversationId}/objective-checks`;

    const [hidden, hiddenCheck, notConnected] = await Promise.all([
      stranger.get(`/v1/language-conversations/${conversationId}`),
      stranger.post(checks, { data: { turns } }),
      apiContext.post(checks, { data: { turns } }),
    ]);

    expect([hidden.status(), hiddenCheck.status(), notConnected.status()]).toStrictEqual([
      404, 404, 422,
    ]);

    // Only the character spoke, so no objective or feedback model is called.
    const completion = { spokenSeconds: 0, turns, usedHelp: true };

    const [first, again] = [
      await apiContext.post(`/v1/language-conversations/${conversationId}/completions`, {
        data: completion,
      }),
      await apiContext.post(`/v1/language-conversations/${conversationId}/completions`, {
        data: completion,
      }),
    ];

    expect(first.status()).toBe(200);

    expect(await first.json()).toMatchObject({
      result: { brainPower: 0, feedback: null, stars: 1 },
      status: "completed",
    });

    expect(await again.json()).toStrictEqual(await first.json());

    const [reconnect, lateCheck] = await Promise.all([
      apiContext.post(`/v1/language-conversations/${conversationId}/connections`),
      apiContext.post(checks, { data: { turns } }),
    ]);

    expect([reconnect.status(), lateCheck.status()]).toStrictEqual([409, 409]);

    await Promise.all([apiContext.dispose(), stranger.dispose()]);
  });

  test("won't reopen an old call and stops at the free plan's daily calls", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "language-call-limit",
    });

    const { renting } = await languageGoalFixture({ userId: user.id });

    const start = async (): Promise<string> => {
      const started = await apiContext.post("/v1/language-conversations", {
        data: { chapterId: renting.id, kind: "practice", minutes: 2 },
      });

      const { conversationId } = (await started.json()) as { conversationId: string };
      return conversationId;
    };

    const oldCall = await start();

    await prisma.usageRecord.create({
      data: {
        createdAt: new Date(Date.now() - ELEVEN_MINUTES_MS),
        kind: "conversation",
        targetId: oldCall,
        userId: user.id,
      },
    });

    const reopened = await apiContext.post(`/v1/language-conversations/${oldCall}/connections`);

    expect(reopened.status()).toBe(409);
    await expect(reopened.json()).resolves.toMatchObject({ error: { code: "CONVERSATION_ENDED" } });

    await usageRecordsFixture({
      count: FREE_DAILY_CONVERSATIONS,
      kind: "conversation",
      userId: user.id,
    });

    const limited = await apiContext.post(
      `/v1/language-conversations/${await start()}/connections`,
    );

    expect(limited.status()).toBe(429);

    await expect(limited.json()).resolves.toMatchObject({
      error: { code: "CONVERSATION_LIMIT_REACHED", details: { limit: FREE_DAILY_CONVERSATIONS } },
    });

    await apiContext.dispose();
  });

  test("runs the level test and sets a level for each skill it tested", async () => {
    await ensureLevelTestBank();

    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "language-level",
    });

    const { goal } = await languageGoalFixture({ userId: user.id });
    const path = `/v1/goals/${goal.id}/language-level-test`;

    const firstResponse = await apiContext.get(path);
    const first = await firstResponse.json();

    expect(first).toMatchObject({
      next: { kind: "question", question: { level: "A2", skill: "reading" } },
      status: "ready",
    });

    expect(first.next.question.answerIndex).toBeUndefined();

    const answered = await apiContext.post(`${path}/answers`, {
      data: { answerIndex: 0, questionId: first.next.question.id },
    });

    expect(await answered.json()).toMatchObject({ answered: 1, lastCorrect: true });

    const stale = await apiContext.post(`${path}/answers`, {
      data: { answerIndex: 0, questionId: first.next.question.id },
    });

    expect(stale.status()).toBe(422);

    const finished = await apiContext.post(`${path}/completions`);

    expect(finished.status()).toBe(200);
    const finishedBody = await finished.json();

    // No sentence was said out loud, so speaking gets no level.
    expect(finishedBody.levels.map((level: { skill: string }) => level.skill)).toStrictEqual([
      "reading",
      "listening",
      "writing",
    ]);

    await apiContext.dispose();
  });

  test("never writes the questions when the test is shown: the learner's tap starts their run", async () => {
    await ensureLevelTestBank();

    const [{ apiContext, user }, { apiContext: stranger }, anonymous] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "level-bank" }),
      createAuthenticatedApiContext({ baseURL, prefix: "level-bank-stranger" }),
      request.newContext({ baseURL }),
    ]);

    const [{ goal: newPair }, { goal: writtenPair }, learnGoal] = await Promise.all([
      languageGoalFixture({ userId: user.id }),
      languageGoalFixture({ userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    // A pair no other test writes: the learner language is a made-up code.
    const pair = { language: `x${randomUUID().slice(0, 8)}`, targetLanguage: "en" };
    await prisma.goal.update({ data: pair, where: { id: newPair.id } });

    const path = `/v1/goals/${newPair.id}/language-level-test`;
    const shown = await apiContext.get(path);

    expect(await shown.json()).toStrictEqual({
      expectedSeconds: 120,
      startedAt: null,
      status: "preparing",
    });

    await expect(prisma.languageLevelTest.count({ where: pair })).resolves.toBe(0);

    const [started, ready, ...refused] = await Promise.all([
      apiContext.post(`${path}/generations`),
      apiContext.post(`/v1/goals/${writtenPair.id}/language-level-test/generations`),
      anonymous.post(`${path}/generations`),
      stranger.post(`${path}/generations`),
      apiContext.post(`/v1/goals/${learnGoal.id}/language-level-test/generations`),
    ]);

    expect(started.status()).toBe(202);

    expect(await started.json()).toStrictEqual({
      generationId: expect.any(String),
      status: "started",
    });

    expect(ready.status()).toBe(200);
    expect(await ready.json()).toStrictEqual({ generationId: null, status: "ready" });

    expect(refused.map((response) => response.status())).toStrictEqual([401, 404, 422]);

    await Promise.all([apiContext.dispose(), stranger.dispose(), anonymous.dispose()]);
  });

  test("shows a noticed pattern and scores its drill", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL,
      prefix: "language-pattern",
    });

    const { goal } = await languageGoalFixture({ userId: user.id });

    const pattern = await prisma.mistakePattern.create({
      data: {
        content: {
          contrast: [{ example: "since 2020", label: "since + quando começou" }],
          drill: [
            {
              answer: "for",
              feedback: "Duração.",
              options: ["since", "for", "from"],
              sentence: "I've lived here ___ six years.",
            },
          ],
          examples: [
            {
              answer: "I live here since 2020",
              correctAnswer: "I've lived here since 2020",
              format: "typedAnswer",
            },
          ],
          rule: "Começou no passado e continua? Use have + particípio.",
        },
        goalId: goal.id,
        kind: "pattern",
        language: "en",
        model: "test",
        promptVersion: "test",
        runId: "test",
        title: "since e for",
        userId: user.id,
      },
    });

    const view = await apiContext.get(`/v1/mistake-patterns/${pattern.id}`);

    expect(await view.json()).toMatchObject({
      occurrences: 1,
      practiced: false,
      title: "since e for",
    });

    const practice = await apiContext.post(`/v1/mistake-patterns/${pattern.id}/practices`, {
      data: { answers: ["for"] },
    });

    expect(await practice.json()).toMatchObject({ correct: 1, total: 1 });

    const dismissed = await apiContext.post(`/v1/mistake-patterns/${pattern.id}/dismissals`);
    expect(dismissed.status()).toBe(204);

    const todayResponse = await apiContext.get(`/v1/goals/${goal.id}/language-today`);
    const today = await todayResponse.json();
    expect(today.pattern).toBeNull();

    await apiContext.dispose();
  });

  test("keeps the level test to its learner's language goal", async () => {
    const [{ apiContext, user }, { apiContext: stranger }, anonymous] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "level-owner" }),
      createAuthenticatedApiContext({ baseURL, prefix: "level-stranger" }),
      request.newContext({ baseURL }),
    ]);

    const [{ goal }, learnGoal] = await Promise.all([
      languageGoalFixture({ userId: user.id }),
      goalFixture({ userId: user.id }),
    ]);

    const path = `/v1/goals/${goal.id}/language-level-test`;
    const answer = { data: { answerIndex: 0, questionId: "reading-A2-0" } };

    const responses = await Promise.all([
      anonymous.post(`${path}/answers`, answer),
      anonymous.post(`${path}/completions`),
      stranger.post(`${path}/answers`, answer),
      stranger.post(`${path}/completions`),
      apiContext.post("/v1/goals/not-a-goal/language-level-test/answers", answer),
      apiContext.post(`${path}/answers`, { data: { answerIndex: 9, questionId: "reading-A2-0" } }),
      apiContext.post(`/v1/goals/${learnGoal.id}/language-level-test/completions`),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([
      401, 401, 404, 404, 400, 400, 422,
    ]);

    await Promise.all([apiContext.dispose(), stranger.dispose(), anonymous.dispose()]);
  });
});
