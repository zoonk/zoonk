import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { languageConversationViewSchema } from "@zoonk/core/language/conversations/contract";
import { studyBlockCompletionSchema } from "@zoonk/core/sessions/completion-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { languageGoalFixture } from "@zoonk/testing/fixtures/language";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { getDateInTimeZone } from "@zoonk/utils/time-zone";
import {
  challengeGenerationSchema,
  challengeResponseSchema,
  challengeStartResponseSchema,
  checkpointResponseSchema,
} from "../src/lib/openapi/schemas/checkpoints";
import { languageConversationCreatedSchema } from "../src/lib/openapi/schemas/language";
import { planResponseSchema } from "../src/lib/openapi/schemas/plans";
import { todayResponseSchema } from "../src/lib/openapi/schemas/today";
import { createBearerLearner } from "./helpers/bearer";
import { createExamGoal } from "./helpers/exams";
import { readBody } from "./helpers/response";

const QUESTIONS_PER_SKILL = 3;
const SKILL_NAMES = ["Discounts", "Ratios"];

/** The boss asks every question of the phase's skills, since there are fewer than ten. */
const BOSS_QUESTIONS = QUESTIONS_PER_SKILL * SKILL_NAMES.length;

function addQuestions({ count, skillId }: { count: number; skillId: string }) {
  return Array.from({ length: count }, () =>
    itemFixture({ content: choiceItemContent(), skillId }),
  );
}

/**
 * A goal whose first phase (two lessons) is done, so today's session is the phase's boss, its two
 * skills holding `questionsPerSkill` questions each.
 */
async function createGoalAtBoss(userId: string, questionsPerSkill = QUESTIONS_PER_SKILL) {
  const [goal, skills, lessons] = await Promise.all([
    goalFixture({ dailyMinutes: 30, timezone: "UTC", userId }),
    Promise.all(SKILL_NAMES.map((name) => skillFixture({ name }))),
    Promise.all([
      libraryLessonFixture({ title: "Discounts" }),
      libraryLessonFixture({ title: "Ratios" }),
      libraryLessonFixture({ title: "Percent change" }),
    ]),
  ]);

  const plan = await planFixture({
    goalId: goal.id,
    phases: [{ name: "Basics" }, { name: "Mix" }],
  });

  await Promise.all([
    ...skills.flatMap((skill) => addQuestions({ count: questionsPerSkill, skillId: skill.id })),
    ...skills.map((skill, index) =>
      lessonSkillFixture({ lessonId: lessons[index]?.id ?? "", skillId: skill.id }),
    ),
    ...lessons.map((lesson, position) => {
      const firstPhase = position < SKILL_NAMES.length;

      return planItemFixture({
        kind: "lesson",
        lessonId: lesson.id,
        phase: firstPhase ? 0 : 1,
        planId: plan.id,
        position: firstPhase ? position : position + 1,
        status: firstPhase ? "done" : "todo",
        titleSnapshot: lesson.title,
      });
    }),
    planItemFixture({
      kind: "boss",
      phase: 0,
      planId: plan.id,
      position: SKILL_NAMES.length,
      // C2 requires the saved due day; completed teaching does not unlock an undated boss.
      scheduledFor: getDateInTimeZone({ date: new Date(), timeZone: "UTC" }),
      titleSnapshot: "Boss",
    }),
  ]);

  return goal;
}

/** A language unit reached with its call already written, including a pending locked challenge. */
async function createLanguageBoss({
  final,
  plus,
  userId,
}: {
  final: boolean;
  plus: boolean;
  userId: string;
}) {
  const { arriving, goal, plan, renting } = await languageGoalFixture({ userId });

  await Promise.all([
    prisma.goal.update({ data: { timezone: "UTC" }, where: { id: goal.id } }),
    prisma.planItem.updateMany({ data: { status: "done" }, where: { planId: plan.id } }),
    prisma.plan.update({
      data: {
        phases: [
          { name: arriving.title },
          { name: renting.title },
          ...(final ? [] : [{ name: "The next unit" }]),
        ],
      },
      where: { id: plan.id },
    }),
    !final &&
      planItemFixture({ kind: "lesson", phase: 2, planId: plan.id, position: 11, status: "done" }),
    plus &&
      prisma.subscription.create({
        data: { id: randomUUID(), plan: "plus", referenceId: userId, status: "active" },
      }),
  ]);

  // C2 requires the saved due day for the call as well as completed teaching.
  const boss = await planItemFixture({
    kind: "boss",
    phase: 1,
    planId: plan.id,
    position: 10,
    scheduledFor: getDateInTimeZone({ date: new Date(), timeZone: "UTC" }),
  });

  return { boss, goal };
}

test.describe("Checkpoints API", () => {
  const baseURL = process.env.E2E_BASE_URL ?? "";

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication", async () => {
    const api = await request.newContext({ baseURL });
    const id = randomUUID();

    const responses = await Promise.all([
      api.get(`/v1/checkpoints/${id}`),
      api.post(`/v1/checkpoints/${id}/moves`, { data: {} }),
      api.delete(`/v1/checkpoints/${id}/moves/${randomUUID()}`),
      api.get(`/v1/challenges/${id}?timeZone=UTC`),
      api.post(`/v1/challenges/${id}/starts`, { data: { timeZone: "UTC" } }),
      api.post(`/v1/challenges/${id}/moves`, { data: { timeZone: "UTC" } }),
      api.delete(`/v1/challenges/${id}/moves/${randomUUID()}?timeZone=UTC`),
      api.post(`/v1/challenges/${id}/generations`),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual(responses.map(() => 401));

    await api.dispose();
  });

  test("describes a boss upfront, then how the duel went, only to its learner", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "checkpoint" }),
      createBearerLearner({ baseURL, prefix: "checkpoint-other" }),
    ]);

    const goal = await createGoalAtBoss(userId);

    const { session: today } = await readBody({
      response: await api.get(`/v1/today?goalId=${goal.id}&timeZone=UTC`),
      schema: todayResponseSchema,
    });

    const boss = today.blocks.find((block) => block.kind === "checkpoint");
    const path = `/v1/checkpoints/${boss?.id}`;

    const before = await readBody({
      response: await api.get(path),
      schema: checkpointResponseSchema,
    });

    expect(before).toMatchObject({
      kind: "boss",
      nextPhase: { index: 1, name: "Mix" },
      phase: { index: 0, name: "Basics" },
      result: null,
      reward: { badge: true, glasses: "star", phaseComplete: true },
      sessionId: today.id,
      status: "pending",
    });

    expect(before.questions).toHaveLength(BOSS_QUESTIONS);

    const blockPath = `/v1/study-sessions/${today.id}/blocks/${boss?.id}`;
    await api.post(`${blockPath}/starts`, { data: {} });

    await before.questions.reduce(async (previous, question) => {
      await previous;

      await api.post(`${blockPath}/answers`, {
        data: { answer: { selectedIndex: 0 }, durationMs: 4000, itemId: question.itemId },
      });
    }, Promise.resolve());

    await readBody({
      response: await api.post(`${blockPath}/completions`, { data: {} }),
      schema: studyBlockCompletionSchema,
    });

    const after = await readBody({
      response: await api.get(path),
      schema: checkpointResponseSchema,
    });

    expect(after).toMatchObject({
      result: { correct: BOSS_QUESTIONS, passed: true, total: BOSS_QUESTIONS },
      status: "completed",
    });

    await prisma.item.deleteMany({
      where: { id: { in: before.questions.map((question) => question.itemId) } },
    });

    const reopened = await readBody({
      response: await api.get(path),
      schema: checkpointResponseSchema,
    });

    expect(reopened).toMatchObject({
      questions: [],
      result: { correct: BOSS_QUESTIONS, passed: true, total: BOSS_QUESTIONS },
      status: "completed",
    });

    const hidden = await other.api.get(path);
    expect(hidden.status()).toBe(404);

    // Only the week's challenge moves to Monday; a boss keeps its day.
    const bossMove = await api.post(`${path}/moves`, { data: {} });
    expect(bossMove.status()).toBe(404);
  });

  test("ends a duel whose questions vanished without a verdict or reward", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "checkpoint-empty" });
    const goal = await createGoalAtBoss(userId);

    const { session: today } = await readBody({
      response: await api.get(`/v1/today?goalId=${goal.id}&timeZone=UTC`),
      schema: todayResponseSchema,
    });

    const boss = today.blocks.find((block) => block.kind === "checkpoint");
    const path = `/v1/checkpoints/${boss?.id}`;
    const blockPath = `/v1/study-sessions/${today.id}/blocks/${boss?.id}`;

    const before = await readBody({
      response: await api.get(path),
      schema: checkpointResponseSchema,
    });

    const started = await api.post(`${blockPath}/starts`, { data: {} });
    expect(started.status()).toBe(200);

    await prisma.item.deleteMany({
      where: { id: { in: before.questions.map((question) => question.itemId) } },
    });

    const completion = await readBody({
      response: await api.post(`${blockPath}/completions`, { data: {} }),
      schema: studyBlockCompletionSchema,
    });

    expect(completion).toMatchObject({
      brainPower: 0,
      checkpoint: null,
      correct: 0,
      milestones: [],
      total: 0,
    });

    const reopened = await readBody({
      response: await api.get(path),
      schema: checkpointResponseSchema,
    });

    expect(reopened).toMatchObject({ questions: [], result: null, status: "skipped" });

    await expect(
      prisma.planItem.findFirstOrThrow({ where: { kind: "boss", plan: { goalId: goal.id } } }),
    ).resolves.toMatchObject({ status: "todo" });

    await expect(
      prisma.learningEvent.count({ where: { kind: "checkpoint", userId } }),
    ).resolves.toBe(0);

    await api.dispose();
  });

  test("a boss's challenge says what it asks on its day and starts its block, only for its learner", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "challenge" }),
      createBearerLearner({ baseURL, prefix: "challenge-other" }),
    ]);

    const goal = await createGoalAtBoss(userId);

    const boss = await prisma.planItem.findFirstOrThrow({
      where: { kind: "boss", plan: { goalId: goal.id } },
    });

    const path = `/v1/challenges/${boss.id}`;

    const intro = await readBody({
      response: await api.get(`${path}?timeZone=UTC`),
      schema: challengeResponseSchema,
    });

    expect(intro).toMatchObject({
      blockId: null,
      call: null,
      canMove: false,
      goalId: goal.id,
      kind: "boss",
      locked: false,
      phase: { index: 0, name: "Basics" },
      planItemId: boss.id,
      questions: BOSS_QUESTIONS,
      status: "ready",
    });

    // Reading the intro writes nothing: only Start makes the day's session and its block.
    await expect(prisma.studySession.count({ where: { goalId: goal.id } })).resolves.toBe(0);

    const started = await readBody({
      response: await api.post(`${path}/starts`, { data: { timeZone: "UTC" } }),
      schema: challengeStartResponseSchema,
    });

    expect(started).toMatchObject({ blockId: expect.any(String), kind: "checkpoint" });

    const running = await readBody({
      response: await api.get(`${path}?timeZone=UTC`),
      schema: challengeResponseSchema,
    });

    expect(running).toMatchObject({ blockId: started.blockId, status: "started" });

    const [hidden, bossMove] = await Promise.all([
      other.api.get(`${path}?timeZone=UTC`),
      api.post(`${path}/moves`, { data: { timeZone: "UTC" } }),
    ]);

    expect(hidden.status()).toBe(404);

    // Only the week's challenge moves to Monday; a boss keeps its day.
    expect(bossMove.status()).toBe(409);
  });

  // A boss the bank held too few questions for stays in the day: starting it says so, and its
  // generations write what it lacks of its ten (a model call, so each counts as AI help).
  test("a boss short of questions asks for them to be written before it starts", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "challenge-thin" }),
      createBearerLearner({ baseURL, prefix: "challenge-thin-other" }),
    ]);

    const goal = await createGoalAtBoss(userId, 1);

    const boss = await prisma.planItem.findFirstOrThrow({
      where: { kind: "boss", plan: { goalId: goal.id } },
    });

    const path = `/v1/challenges/${boss.id}`;

    const intro = await readBody({
      response: await api.get(`${path}?timeZone=UTC`),
      schema: challengeResponseSchema,
    });

    expect(intro).toMatchObject({ passMark: 7, questions: 10, status: "ready" });

    const refused = await api.post(`${path}/starts`, { data: { timeZone: "UTC" } });
    expect(refused.status()).toBe(409);
    await expect(refused.json()).resolves.toMatchObject({ error: { code: "QUESTIONS_NEEDED" } });

    const [hidden, writing] = await Promise.all([
      other.api.post(`${path}/generations`),
      api.post(`${path}/generations`),
    ]);

    expect(hidden.status()).toBe(404);

    const run = await readBody({
      response: writing,
      schema: challengeGenerationSchema,
      status: 202,
    });

    expect(run).toStrictEqual({ generationId: expect.any(String), status: "generating" });
    expect(writing.headers().location).toBe(`/v1/generations/${run.generationId}`);

    // Once the bank holds them, nothing is written and it starts.
    const skills = await prisma.lessonSkill.findMany({
      where: { lesson: { planItems: { some: { phase: 0, plan: { goalId: goal.id } } } } },
    });

    await Promise.all(
      skills.flatMap((skill) => addQuestions({ count: 4, skillId: skill.skillId })),
    );

    await expect(
      readBody({
        response: await api.post(`${path}/generations`),
        schema: challengeGenerationSchema,
      }),
    ).resolves.toStrictEqual({ generationId: null, status: "ready" });

    const started = await readBody({
      response: await api.post(`${path}/starts`, { data: { timeZone: "UTC" } }),
      schema: challengeStartResponseSchema,
    });

    expect(started).toMatchObject({ blockId: expect.any(String), kind: "checkpoint" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: started.blockId } }),
    ).resolves.toMatchObject({ status: "active" });
  });

  test("an included exam mock is unlocked", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "challenge-mock" });
    const { goal } = await createExamGoal(userId);

    const mock = await prisma.planItem.findFirstOrThrow({
      where: { kind: "mock", plan: { goalId: goal.id } },
    });

    const intro = await readBody({
      response: await api.get(`/v1/challenges/${mock.id}?timeZone=UTC`),
      schema: challengeResponseSchema,
    });

    expect(intro).toMatchObject({ call: null, kind: "weekly", locked: false, mock: true });
    await api.dispose();
  });

  // oxlint-disable-next-line vitest/prefer-each -- Playwright doesn't provide test.each.
  for (const final of [false, true]) {
    // oxlint-disable-next-line vitest/prefer-each -- Playwright doesn't provide test.each.
    for (const plus of [false, true]) {
      test(`${plus ? "Plus" : "Free"} language ${final ? "final" : "phase"} challenges keep the call ${plus ? "unlocked" : "locked"}`, async () => {
        const { api, userId } = await createBearerLearner({ baseURL, prefix: "language-boss" });
        const { boss, goal } = await createLanguageBoss({ final, plus, userId });
        const path = `/v1/challenges/${boss.id}`;

        const intro = await readBody({
          response: await api.get(`${path}?timeZone=UTC`),
          schema: challengeResponseSchema,
        });

        expect(intro).toMatchObject({
          kind: final ? "finalBoss" : "boss",
          locked: !plus,
          questions: 0,
          result: null,
          status: plus ? "ready" : "plusRequired",
        });

        expect(intro.call).toMatchObject({ level: "A2", targetLanguage: "en" });

        const plan = await readBody({
          response: await api.get(`/v1/goals/${goal.id}/plan`),
          schema: planResponseSchema,
        });

        expect(plan.phases.find((phase) => phase.index === 1)?.checkpoint).toMatchObject({
          locked: !plus,
          planItemId: boss.id,
          state: "upcoming",
        });

        expect(plan.end).toStrictEqual(plus ? null : { kind: "finished" });

        if (plus) {
          const started = await readBody({
            response: await api.post(`${path}/starts`, { data: { timeZone: "UTC" } }),
            schema: challengeStartResponseSchema,
          });

          expect(started).toMatchObject({ blockId: expect.any(String), kind: "checkpoint" });

          const call = await readBody({
            response: await api.post("/v1/language-conversations", {
              data: { blockId: started.blockId, kind: "checkpoint" },
            }),
            schema: languageConversationCreatedSchema,
            status: 201,
          });

          await expect(
            prisma.languageConversation.findUniqueOrThrow({ where: { id: call.conversationId } }),
          ).resolves.toMatchObject({ kind: "checkpoint", studyBlockId: started.blockId });

          await api.dispose();
          return;
        }

        const [refused, generation] = await Promise.all([
          api.post(`${path}/starts`, { data: { timeZone: "UTC" } }),
          api.post(`${path}/generations`),
        ]);

        expect(refused.status()).toBe(402);
        expect(generation.status()).toBe(402);
        await expect(refused.json()).resolves.toMatchObject({ error: { code: "PLUS_REQUIRED" } });

        await expect(generation.json()).resolves.toMatchObject({
          error: { code: "PLUS_REQUIRED" },
        });

        await expect(
          prisma.planItem.findUniqueOrThrow({ where: { id: boss.id } }),
        ).resolves.toMatchObject({ status: "todo" });

        await expect(prisma.languageConversation.count({ where: { userId } })).resolves.toBe(0);
        await expect(prisma.aiCall.count({ where: { userId } })).resolves.toBe(0);
        await expect(prisma.usageRecord.count({ where: { userId } })).resolves.toBe(0);
        await api.dispose();
      });
    }
  }

  test("a language challenge locks when Plus lapses between its intro and Start", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "language-lapse" });
    const { boss } = await createLanguageBoss({ final: false, plus: true, userId });
    const path = `/v1/challenges/${boss.id}`;

    const intro = await readBody({
      response: await api.get(`${path}?timeZone=UTC`),
      schema: challengeResponseSchema,
    });

    expect(intro).toMatchObject({ blockId: null, locked: false, questions: 0, status: "ready" });
    expect(intro.call).not.toBeNull();

    await prisma.subscription.updateMany({
      data: { status: "canceled" },
      where: { referenceId: userId },
    });

    const refused = await api.post(`${path}/starts`, { data: { timeZone: "UTC" } });
    expect(refused.status()).toBe(402);
    await expect(refused.json()).resolves.toMatchObject({ error: { code: "PLUS_REQUIRED" } });

    // Neither the intro nor the refused Start made the day's session or the call's block.
    await expect(prisma.studySession.count({ where: { userId } })).resolves.toBe(0);

    const locked = await readBody({
      response: await api.get(`${path}?timeZone=UTC`),
      schema: challengeResponseSchema,
    });

    expect(locked).toMatchObject({
      locked: true,
      questions: 0,
      result: null,
      status: "plusRequired",
    });

    expect(locked.call).toStrictEqual(intro.call);
    await expect(prisma.languageConversation.count({ where: { userId } })).resolves.toBe(0);
    await expect(prisma.aiCall.count({ where: { userId } })).resolves.toBe(0);
    await expect(prisma.usageRecord.count({ where: { userId } })).resolves.toBe(0);
    await api.dispose();
  });

  test("a checkpoint call opened with Plus cannot connect after the subscription lapses", async () => {
    const { api, userId } = await createBearerLearner({
      baseURL,
      prefix: "language-connect-lapse",
    });

    const { boss } = await createLanguageBoss({ final: false, plus: true, userId });

    const started = await readBody({
      response: await api.post(`/v1/challenges/${boss.id}/starts`, { data: { timeZone: "UTC" } }),
      schema: challengeStartResponseSchema,
    });

    const call = await readBody({
      response: await api.post("/v1/language-conversations", {
        data: { blockId: started.blockId, kind: "checkpoint" },
      }),
      schema: languageConversationCreatedSchema,
      status: 201,
    });

    const before = await readBody({
      response: await api.get(`/v1/language-conversations/${call.conversationId}`),
      schema: languageConversationViewSchema,
    });

    expect(before).toMatchObject({ kind: "checkpoint", locked: false });

    await prisma.subscription.updateMany({
      data: { status: "canceled" },
      where: { referenceId: userId },
    });

    const after = await readBody({
      response: await api.get(`/v1/language-conversations/${call.conversationId}`),
      schema: languageConversationViewSchema,
    });

    expect(after).toMatchObject({ kind: "checkpoint", locked: true });

    // The block started while Plus was active: neither it nor its call opens again without Plus.
    const [refused, blockStart, callStart] = await Promise.all([
      api.post(`/v1/language-conversations/${call.conversationId}/connections`),
      api.post(`/v1/study-sessions/${started.sessionId}/blocks/${started.blockId}/starts`, {
        data: { timeZone: "UTC" },
      }),
      api.post("/v1/language-conversations", {
        data: { blockId: started.blockId, kind: "checkpoint" },
      }),
    ]);

    await Promise.all(
      [refused, blockStart, callStart].map(async (response) => {
        expect(response.status()).toBe(402);
        await expect(response.json()).resolves.toMatchObject({ error: { code: "PLUS_REQUIRED" } });
      }),
    );

    // Existing completed feedback stays readable, but another challenge call still needs Plus.
    await prisma.languageConversation.update({
      data: { spokenSeconds: 0, status: "completed" },
      where: { id: call.conversationId },
    });

    const completed = await readBody({
      response: await api.get(`/v1/language-conversations/${call.conversationId}`),
      schema: languageConversationViewSchema,
    });

    expect(completed).toMatchObject({
      locked: true,
      result: { passed: false },
      status: "completed",
    });

    await prisma.planItem.update({ data: { status: "done" }, where: { id: boss.id } });

    const done = await readBody({
      response: await api.get(`/v1/challenges/${boss.id}?timeZone=UTC`),
      schema: challengeResponseSchema,
    });

    expect(done).toMatchObject({ locked: true, status: "done" });

    await expect(prisma.aiCall.count({ where: { userId } })).resolves.toBe(0);
    await expect(prisma.usageRecord.count({ where: { userId } })).resolves.toBe(0);
    await api.dispose();
  });
});
