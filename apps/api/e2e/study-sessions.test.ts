import { randomUUID } from "node:crypto";
import { type APIRequestContext, request } from "@playwright/test";
import { studyBlockCompletionSchema } from "@zoonk/core/sessions/completion-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import { sourceFixture } from "@zoonk/testing/fixtures/sources";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import {
  buddyStatusResponseSchema,
  milestoneListResponseSchema,
  weeklyRecapResponseSchema,
} from "../src/lib/openapi/schemas/milestones";
import { studySessionSummaryResponseSchema } from "../src/lib/openapi/schemas/study-session-results";
import {
  startedStudyBlockResponseSchema,
  studyAnswerFeedbackResponseSchema,
  studyBlockDetailResponseSchema,
  studyBlockSchema,
} from "../src/lib/openapi/schemas/study-sessions";
import { todayResponseSchema } from "../src/lib/openapi/schemas/today";
import { weeklyChallengeResponseSchema } from "../src/lib/openapi/schemas/weekly-challenge";
import { createBearerLearner } from "./helpers/bearer";
import { readBody } from "./helpers/response";

const DAY_MS = 86_400_000;

/**
 * A goal whose first of two lessons is done: its skill is due for review and has a mistake saved
 * yesterday, so today's session has capsules, the next lesson and a mistake to fix. It's past its
 * first week, when sessions still ask placement questions about skills placement was unsure of.
 */
async function createGoal(userId: string) {
  const [goal, skills, lessons] = await Promise.all([
    goalFixture({
      createdAt: new Date(Date.now() - 30 * DAY_MS),
      dailyMinutes: 30,
      timezone: "UTC",
      userId,
    }),
    Promise.all([skillFixture({ name: "Discounts" }), skillFixture({ name: "Ratios" })]),
    Promise.all([
      libraryLessonFixture({ canDo: "You'll work out a discount", title: "Discounts" }),
      libraryLessonFixture({ canDo: "You'll compare ratios", title: "Ratios" }),
    ]),
  ]);

  const plan = await planFixture({ goalId: goal.id });

  const [items] = await Promise.all([
    Promise.all(
      skills.flatMap((skill) =>
        Array.from({ length: 3 }, () =>
          itemFixture({ content: choiceItemContent(), skillId: skill.id }),
        ),
      ),
    ),
    ...lessons.map((lesson, index) =>
      lessonSkillFixture({ lessonId: lesson.id, skillId: skills[index]?.id ?? "" }),
    ),
    ...lessons.map((lesson, position) =>
      planItemFixture({
        kind: "lesson",
        lessonId: lesson.id,
        planId: plan.id,
        position,
        status: position === 0 ? "done" : "todo",
        titleSnapshot: lesson.title,
      }),
    ),
  ]);

  await Promise.all([
    learnerSkillFixture({
      difficulty: 5,
      due: new Date(Date.now() - DAY_MS),
      lastReviewedAt: new Date(Date.now() - 4 * DAY_MS),
      reps: 2,
      skillId: skills[0]?.id ?? "",
      stability: 3,
      state: "learning",
      userId,
    }),
    mistakeFixture({
      createdAt: new Date(Date.now() - DAY_MS),
      itemId: items[0]?.id,
      skillId: skills[0]?.id,
      userId,
    }),
  ]);

  return { goal, items, lessons, plan, skills };
}

async function playBlock({
  api,
  blockId,
  sessionId,
}: {
  api: APIRequestContext;
  blockId: string;
  sessionId: string;
}) {
  const blockPath = `/v1/study-sessions/${sessionId}/blocks/${blockId}`;

  await readBody({
    response: await api.post(`${blockPath}/starts`, { data: {} }),
    schema: startedStudyBlockResponseSchema,
  });

  const detail = await readBody({
    response: await api.get(blockPath),
    schema: studyBlockDetailResponseSchema,
  });

  // Questions are answered one after another, like a learner does.
  await detail.questions.reduce(async (previous, question) => {
    await previous;

    await readBody({
      response: await api.post(`${blockPath}/answers`, {
        data: { answer: { selectedIndex: 0 }, durationMs: 4000, itemId: question.itemId },
      }),
      schema: studyAnswerFeedbackResponseSchema,
    });
  }, Promise.resolve());

  return readBody({
    response: await api.post(`${blockPath}/completions`, { data: {} }),
    schema: studyBlockCompletionSchema,
  });
}

test.describe("Study sessions API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("requires authentication for every session resource", async () => {
    const api = await request.newContext({ baseURL });
    const id = randomUUID();

    const responses = await Promise.all([
      api.get(`/v1/study-sessions/${id}`),
      api.get(`/v1/study-sessions/${id}/summary`),
      api.post(`/v1/study-sessions/${id}/stops`, { data: {} }),
      api.post(`/v1/study-sessions/${id}/extra-blocks`),
      api.get(`/v1/study-sessions/${id}/blocks/${id}`),
      api.post(`/v1/study-sessions/${id}/blocks/${id}/starts`, { data: {} }),
      api.post(`/v1/study-sessions/${id}/blocks/${id}/completions`, { data: {} }),
      api.get(`/v1/goals/${id}/weekly-challenge`),
      api.get("/v1/me/milestones"),
      api.post(`/v1/me/milestones/${id}/views`),
      api.get("/v1/me/weekly-recap"),
      api.get("/v1/me/buddy"),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual(responses.map(() => 401));
    await api.dispose();
  });

  test("plays today's session from capsules to the summary", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "study-session" });
    const { goal, lessons, skills } = await createGoal(userId);

    const { session: today } = await readBody({
      response: await api.get(`/v1/today?goalId=${goal.id}&timeZone=UTC`),
      schema: todayResponseSchema,
    });

    expect(today.blocks.map((block) => block.kind)).toStrictEqual(["review", "learn", "practice"]);

    expect(today.blocks[1]).toMatchObject({
      canDo: "You'll compare ratios",
      lessonId: lessons[1]?.id,
    });

    const { session: again } = await readBody({
      response: await api.get(`/v1/today?goalId=${goal.id}`),
      schema: todayResponseSchema,
    });

    expect(again.id).toBe(today.id);

    const [review, learn, practice] = today.blocks;
    const reviewDone = await playBlock({ api, blockId: review?.id ?? "", sessionId: today.id });

    expect(reviewDone).toMatchObject({ capsulesOpened: 1, sessionCompleted: false });
    expect(reviewDone.brainPower).toBeGreaterThan(0);

    const learnPath = `/v1/study-sessions/${today.id}/blocks/${learn?.id}`;
    await api.post(`${learnPath}/starts`, { data: {} });

    const early = await api.post(`${learnPath}/completions`, { data: {} });
    expect(early.status()).toBe(409);
    expect(await early.json()).toMatchObject({ error: { code: "LESSON_NOT_FINISHED" } });

    await learningEventFixture({
      brainPower: 20,
      contentIds: { lessonId: lessons[1]?.id ?? "" },
      userId,
    });

    await readBody({
      response: await api.post(`${learnPath}/completions`, { data: {} }),
      schema: studyBlockCompletionSchema,
    });

    const practiceDone = await playBlock({ api, blockId: practice?.id ?? "", sessionId: today.id });
    expect(practiceDone).toMatchObject({ fullMeal: { paid: true }, sessionCompleted: true });

    const summary = await readBody({
      response: await api.get(`/v1/study-sessions/${today.id}/summary`),
      schema: studySessionSummaryResponseSchema,
    });

    expect(summary).toMatchObject({ fullMeal: true, status: "completed", tomorrow: null });
    expect(summary.questions).toBeGreaterThan(0);

    // The lesson taught its skill, so "10 more minutes" has questions to practice.
    await learnerSkillFixture({ reps: 1, skillId: skills[1]?.id ?? "", state: "learning", userId });

    const extra = await readBody({
      response: await api.post(`/v1/study-sessions/${today.id}/extra-blocks`),
      schema: studyBlockSchema,
      status: 201,
    });

    expect(extra).toMatchObject({ extra: true, kind: "practice", status: "pending" });
  });

  test("dates the source a question quotes, for its Sources chip", async () => {
    const url = "https://www.planalto.gov.br/ccivil_03/leis/l8112cons.htm";

    const [{ api, userId }, skill, law] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "study-block-sources" }),
      skillFixture(),
      sourceFixture({
        fetchedAt: new Date("2026-09-12T10:00:00.000Z"),
        publisher: "Planalto",
        title: "Law 8,112",
        url,
      }),
    ]);

    const [drill, session] = await Promise.all([
      itemFixture({
        content: choiceItemContent(),
        skillId: skill.id,
        sourceCitation: "Law 8,112, Art. 20",
        sourceId: law.id,
      }),
      studySessionFixture({ userId }),
    ]);

    const block = await studySessionBlockFixture({
      kind: "practice",
      payload: { itemIds: [drill.id], skillIds: [skill.id] },
      position: 0,
      sessionId: session.id,
    });

    const detail = await readBody({
      response: await api.get(`/v1/study-sessions/${session.id}/blocks/${block.id}`),
      schema: studyBlockDetailResponseSchema,
    });

    expect(detail.questions.map((question) => question.citation)).toStrictEqual([
      {
        checkedAt: "2026-09-12T10:00:00.000Z",
        publisher: "Planalto",
        text: "Law 8,112, Art. 20",
        title: "Law 8,112",
        url,
      },
    ]);

    await api.dispose();
  });

  test("stops for today and hides sessions from other learners", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "study-stop" }),
      createBearerLearner({ baseURL, prefix: "study-other" }),
    ]);

    const { goal } = await createGoal(userId);

    const { session: today } = await readBody({
      response: await api.get(`/v1/today?goalId=${goal.id}`),
      schema: todayResponseSchema,
    });

    const [hidden, notMine] = await Promise.all([
      other.api.get(`/v1/study-sessions/${today.id}`),
      other.api.get(`/v1/today?goalId=${goal.id}`),
    ]);

    expect([hidden.status(), notMine.status()]).toStrictEqual([404, 404]);

    const stopped = await readBody({
      response: await api.post(`/v1/study-sessions/${today.id}/stops`, { data: {} }),
      schema: studySessionSummaryResponseSchema,
    });

    expect(stopped).toMatchObject({ extraTime: { available: true }, status: "completed" });
  });

  test("asks placement questions in the first week and never saves them as mistakes", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "study-placement" });
    const { goal, items, skills } = await createGoal(userId);

    // A goal made today: placement is still unsure where to start the next lesson's skill.
    await prisma.goal.update({ data: { createdAt: new Date() }, where: { id: goal.id } });

    const { session: today } = await readBody({
      response: await api.get(`/v1/today?goalId=${goal.id}&timeZone=UTC`),
      schema: todayResponseSchema,
    });

    const review = today.blocks.find((block) => block.kind === "review");
    const blockPath = `/v1/study-sessions/${today.id}/blocks/${review?.id}`;

    await readBody({
      response: await api.post(`${blockPath}/starts`, { data: {} }),
      schema: startedStudyBlockResponseSchema,
    });

    const detail = await readBody({
      response: await api.get(blockPath),
      schema: studyBlockDetailResponseSchema,
    });

    const placement = detail.questions.find((question) => question.placement);

    const nextSkillItemIds = items
      .filter((item) => item.skillId === skills[1]?.id)
      .map((item) => item.id);

    expect(nextSkillItemIds).toContain(placement?.itemId);

    const feedback = await readBody({
      response: await api.post(`${blockPath}/answers`, {
        data: { answer: { dontKnow: true }, durationMs: 3000, itemId: placement?.itemId },
      }),
      schema: studyAnswerFeedbackResponseSchema,
    });

    expect(feedback).toMatchObject({ isCorrect: false, savedToNotebook: false });

    await expect(
      prisma.mistake.count({ where: { itemId: placement?.itemId, userId } }),
    ).resolves.toBe(0);
  });

  test("reads milestones, the weekly recap, the buddy and the weekly challenge", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "study-milestones" });

    const [{ goal }, milestone] = await Promise.all([
      createGoal(userId),
      prisma.milestone.create({ data: { key: "star", kind: "glasses", userId } }),
    ]);

    const listed = await readBody({
      response: await api.get("/v1/me/milestones"),
      schema: milestoneListResponseSchema,
    });

    expect(listed.ceremony?.id).toBe(milestone.id);

    const viewed = await api.post(`/v1/me/milestones/${milestone.id}/views`);
    expect(viewed.status()).toBe(200);

    const [recap, buddy, challenge] = await Promise.all([
      readBody({
        response: await api.get("/v1/me/weekly-recap?timeZone=UTC"),
        schema: weeklyRecapResponseSchema,
      }),
      readBody({ response: await api.get("/v1/me/buddy"), schema: buddyStatusResponseSchema }),
      readBody({
        response: await api.get(`/v1/goals/${goal.id}/weekly-challenge`),
        schema: weeklyChallengeResponseSchema,
      }),
    ]);

    expect(recap.week.questions).toBe(0);
    expect(buddy).toMatchObject({ buddy: null, stage: "baby" });
    expect(challenge).toStrictEqual({ challenge: null });

    const stranger = await userFixture();

    const strangerMilestone = await prisma.milestone.create({
      data: { key: "badge", kind: "badge", userId: stranger.id },
    });

    const hidden = await api.post(`/v1/me/milestones/${strangerMilestone.id}/views`);

    expect(hidden.status()).toBe(404);
  });
});
