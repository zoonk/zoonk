import { randomUUID } from "node:crypto";
import { type APIRequestContext, request } from "@playwright/test";
import { studyBlockSchema } from "@zoonk/core/sessions/block-view-contract";
import { studyBlockCompletionSchema } from "@zoonk/core/sessions/completion-contract";
import { studyBlockOpeningSchema } from "@zoonk/core/sessions/open-block-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { lessonSkillFixture, libraryLessonFixture } from "@zoonk/testing/fixtures/library-lessons";
import { choiceItemContent, itemFixture, skillFixture } from "@zoonk/testing/fixtures/skills";
import {
  studySessionBlockFixture,
  studySessionFixture,
} from "@zoonk/testing/fixtures/study-sessions";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { milestoneListResponseSchema } from "../src/lib/openapi/schemas/milestones";
import {
  mistakePracticeCompletionSchema,
  mistakePracticeFeedbackSchema,
} from "../src/lib/openapi/schemas/mistakes";
import { openedStudyDayResponseSchema } from "../src/lib/openapi/schemas/open-study-day";
import { studySessionSummaryResponseSchema } from "../src/lib/openapi/schemas/study-session-results";
import {
  startedStudyBlockResponseSchema,
  studyAnswerFeedbackResponseSchema,
  studyBlockDetailResponseSchema,
  studySessionResponseSchema,
} from "../src/lib/openapi/schemas/study-sessions";
import { todayResponseSchema } from "../src/lib/openapi/schemas/today";
import { createBearerLearner } from "./helpers/bearer";
import { openStudyDay } from "./helpers/open-study-day";
import { readBody } from "./helpers/response";

const DAY_MS = 86_400_000;
const CHALLENGE_QUESTIONS = 5;
/** The phase's challenge then asks ten, too long for the welcome-back day after its lesson. */
const QUESTIONS_PER_SKILL = 10;

async function createSessionWithChallengeQuestions(userId: string) {
  const [session, skill] = await Promise.all([
    studySessionFixture({ missions: [], userId }),
    skillFixture(),
  ]);

  const items = await Promise.all(
    Array.from({ length: CHALLENGE_QUESTIONS }, () =>
      itemFixture({ content: choiceItemContent(), skillId: skill.id }),
    ),
  );

  return { itemIds: items.map((item) => item.id), session };
}

function challengePayload({
  itemIds,
  kind,
  mock = false,
}: {
  itemIds: string[];
  kind: "boss" | "finalBoss" | "weekly";
  mock?: boolean;
}) {
  return {
    checkpoint: { kind, mock, passMark: itemIds.length, phase: 0, timeLimitMinutes: null },
    itemIds,
  };
}

async function expectEarlierFirst({
  api,
  blockId,
  path,
  reason,
  sessionId,
  userId,
}: {
  api: APIRequestContext;
  blockId: string;
  path?: string;
  reason: "challenge" | "lessons";
  sessionId: string;
  userId: string;
}) {
  const before = await Promise.all([
    prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } }),
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } }),
    prisma.learningEvent.count({ where: { kind: "session", userId } }),
  ]);

  const refused = await api.post(
    path ?? `/v1/study-sessions/${sessionId}/blocks/${blockId}/starts`,
    { data: { timeZone: "UTC" } },
  );

  expect(refused.status()).toBe(409);

  await expect(refused.json()).resolves.toMatchObject({
    error: { code: "EARLIER_FIRST", details: { reason } },
  });

  const after = await Promise.all([
    prisma.studySession.findUniqueOrThrow({ where: { id: sessionId } }),
    prisma.studySessionBlock.findUniqueOrThrow({ where: { id: blockId } }),
    prisma.learningEvent.count({ where: { kind: "session", userId } }),
  ]);

  expect(after).toStrictEqual(before);
}

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

  const [items] = await Promise.all([
    Promise.all(
      skills.flatMap((skill) =>
        Array.from({ length: QUESTIONS_PER_SKILL }, () =>
          itemFixture({ content: choiceItemContent(), skillId: skill.id }),
        ),
      ),
    ),
    ...lessons.map((lesson, index) =>
      lessonSkillFixture({ lessonId: lesson.id, skillId: skills[index]?.id ?? "" }),
    ),
    planFixture({
      goalId: goal.id,
      items: lessons.map((lesson, position) => ({
        lessonId: lesson.id,
        skillId: skills[position]?.id ?? null,
        status: position === 0 ? ("done" as const) : ("todo" as const),
        titleSnapshot: lesson.title,
      })),
    }),
  ]);

  const [, mistake] = await Promise.all([
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

  return { goal, lessons, mistake, skills };
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
      api.post(`/v1/study-sessions/${id}/extra-blocks`, { data: { timeZone: "UTC" } }),
      api.post(`/v1/study-sessions/${id}/catch-up-blocks`, { data: { timeZone: "UTC" } }),
      api.get(`/v1/study-sessions/${id}/blocks/${id}`),
      api.post(`/v1/study-sessions/${id}/blocks/${id}/starts`, { data: {} }),
      api.post(`/v1/study-sessions/${id}/blocks/${id}/completions`, { data: {} }),
      api.post("/v1/study-block-openings", {
        data: { target: { blockId: id, kind: "block" }, timeZone: "UTC" },
      }),
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
    const { goal, lessons, mistake, skills } = await createGoal(userId);

    const today = await openStudyDay({ api, goalId: goal.id });

    expect(today.blocks.map((block) => block.kind)).toStrictEqual(["review", "learn", "practice"]);

    expect(today.missions.map((mission) => mission.kind)).toStrictEqual([
      "review",
      "somethingNew",
      "fixMistake",
    ]);

    const correction = await readBody({
      response: await api.post(`/v1/me/mistakes/${mistake.id}/answers`, {
        data: {
          answer: { selectedIndex: 0 },
          attemptId: randomUUID(),
          durationMs: 2000,
          itemId: mistake.itemId,
          timeZone: "UTC",
        },
      }),
      schema: mistakePracticeFeedbackSchema,
    });

    expect(correction).toMatchObject({ fixed: true, fixedMistakeIds: [mistake.id] });

    const notebookDone = await readBody({
      response: await api.post("/v1/me/mistake-practice/completions", {
        data: { answerIds: [correction.answerId], ended: true, goalId: goal.id, timeZone: "UTC" },
      }),
      schema: mistakePracticeCompletionSchema,
    });

    expect(notebookDone).toMatchObject({
      missionMoment: { completed: ["fixMistake"], fullMeal: { paid: false } },
    });

    const { session: again } = await readBody({
      response: await api.get(`/v1/today?goalId=${goal.id}`),
      schema: todayResponseSchema,
    });

    expect(again.status).not.toBe("unstarted");
    expect(again).toMatchObject({ id: today.id });

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

    const lessonDone = await readBody({
      response: await api.post(`${learnPath}/completions`, { data: {} }),
      schema: studyBlockCompletionSchema,
    });

    expect(lessonDone).toMatchObject({ fullMeal: { paid: true } });

    const practiceDone = await playBlock({ api, blockId: practice?.id ?? "", sessionId: today.id });
    expect(practiceDone).toMatchObject({ fullMeal: { paid: false }, sessionCompleted: true });

    const summary = await readBody({
      response: await api.get(`/v1/study-sessions/${today.id}/summary`),
      schema: studySessionSummaryResponseSchema,
    });

    expect(summary).toMatchObject({ fullMeal: true, status: "completed", tomorrow: null });
    expect(summary.questions).toBeGreaterThan(0);

    await learnerSkillFixture({ reps: 1, skillId: skills[1]?.id ?? "", state: "learning", userId });

    const extra = await readBody({
      response: await api.post(`/v1/study-sessions/${today.id}/extra-blocks`, {
        data: { timeZone: "UTC" },
      }),
      schema: studyBlockSchema,
      status: 201,
    });

    expect(extra).toMatchObject({ extra: true, kind: "practice", status: "pending" });
  });

  test("opens the day's next step with the day, then each step where the server says", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "study-openings" });
    const { goal } = await createGoal(userId);

    const { session: shown } = await readBody({
      response: await api.get(`/v1/today?goalId=${goal.id}&timeZone=UTC`),
      schema: todayResponseSchema,
    });

    const opened = await readBody({
      response: await api.post(`/v1/goals/${goal.id}/study-sessions`, {
        data: {
          shownDate: shown.localDate,
          target: { kind: "next", shown: null },
          timeZone: "UTC",
        },
      }),
      schema: openedStudyDayResponseSchema,
      status: 201,
    });

    const [review, learn] = opened.session.blocks;

    expect(opened).toMatchObject({
      opening: { blockId: review?.id, kind: "session", sessionId: opened.sessionId },
      targetStatus: "next",
    });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: review?.id } }),
    ).resolves.toMatchObject({ status: "active" });

    const open = (target: object) =>
      api.post("/v1/study-block-openings", { data: { target, timeZone: "UTC" } });

    await expect(
      readBody({
        response: await open({ blockId: learn?.id, kind: "block" }),
        schema: studyBlockOpeningSchema,
      }),
    ).resolves.toStrictEqual({
      blockId: learn?.id,
      kind: "unwrittenLesson",
      lessonId: learn?.lessonId,
      sessionId: opened.sessionId,
    });

    await expect(
      readBody({
        response: await open({
          expectedBlockId: review?.id,
          kind: "next",
          sessionId: opened.sessionId,
        }),
        schema: studyBlockOpeningSchema,
      }),
    ).resolves.toStrictEqual({ blockId: review?.id, kind: "session", sessionId: opened.sessionId });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: learn?.id } }),
    ).resolves.toMatchObject({ status: "pending" });

    const stranger = await createBearerLearner({ baseURL, prefix: "study-openings-stranger" });

    const hidden = await stranger.api.post("/v1/study-block-openings", {
      data: { target: { blockId: learn?.id, kind: "mission" }, timeZone: "UTC" },
    });

    await expect(
      readBody({ response: hidden, schema: studyBlockOpeningSchema }),
    ).resolves.toStrictEqual({ kind: "changed" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: learn?.id } }),
    ).resolves.toMatchObject({ status: "pending" });

    await Promise.all([api.dispose(), stranger.api.dispose()]);
  });

  test("holds a phase challenge for unfinished lessons without opening it or the session", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "study-order-lessons" });

    const [{ itemIds, session }, lesson] = await Promise.all([
      createSessionWithChallengeQuestions(userId),
      libraryLessonFixture(),
    ]);

    const [review, learn, skipped, boss] = await Promise.all([
      studySessionBlockFixture({ kind: "review", position: 0, sessionId: session.id }),
      studySessionBlockFixture({ lessonId: lesson.id, position: 1, sessionId: session.id }),
      studySessionBlockFixture({ position: 2, sessionId: session.id, status: "skipped" }),
      studySessionBlockFixture({
        kind: "checkpoint",
        payload: challengePayload({ itemIds, kind: "boss" }),
        position: 3,
        sessionId: session.id,
      }),
    ]);

    const sessionPath = `/v1/study-sessions/${session.id}`;

    const before = await readBody({
      response: await api.get(`${sessionPath}?timeZone=UTC`),
      schema: studySessionResponseSchema,
    });

    expect(before.blocks.map((block) => block.waitReason)).toStrictEqual([
      null,
      null,
      null,
      "lessons",
    ]);

    expect(session).toMatchObject({ startSnapshot: null, startedAt: null, status: "planned" });
    expect(boss).toMatchObject({ startedAt: null, status: "pending" });

    await expectEarlierFirst({
      api,
      blockId: boss.id,
      reason: "lessons",
      sessionId: session.id,
      userId,
    });

    await readBody({
      response: await api.post(`${sessionPath}/blocks/${learn.id}/starts`, {
        data: { timeZone: "UTC" },
      }),
      schema: startedStudyBlockResponseSchema,
    });

    await expectEarlierFirst({
      api,
      blockId: boss.id,
      reason: "lessons",
      sessionId: session.id,
      userId,
    });

    await learningEventFixture({
      contentIds: { lessonId: lesson.id, studySessionId: session.id },
      userId,
    });

    await readBody({
      response: await api.post(`${sessionPath}/blocks/${learn.id}/completions`, {
        data: { timeZone: "UTC" },
      }),
      schema: studyBlockCompletionSchema,
    });

    const released = await readBody({
      response: await api.get(`${sessionPath}?timeZone=UTC`),
      schema: studySessionResponseSchema,
    });

    expect(released.blocks.find((block) => block.id === boss.id)?.waitReason).toBeNull();

    await readBody({
      response: await api.post(`${sessionPath}/blocks/${boss.id}/starts`, {
        data: { timeZone: "UTC" },
      }),
      schema: startedStudyBlockResponseSchema,
    });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: review.id } }),
    ).resolves.toMatchObject({ startedAt: null, status: "pending" });

    await expect(
      prisma.studySessionBlock.findUniqueOrThrow({ where: { id: skipped.id } }),
    ).resolves.toMatchObject({ status: "skipped" });

    await expect(prisma.usageRecord.count({ where: { userId } })).resolves.toBe(0);
    await api.dispose();
  });

  test("stops for today and hides sessions from other learners", async () => {
    const [{ api, userId }, other] = await Promise.all([
      createBearerLearner({ baseURL, prefix: "study-stop" }),
      createBearerLearner({ baseURL, prefix: "study-other" }),
    ]);

    const { goal } = await createGoal(userId);

    const today = await openStudyDay({ api, goalId: goal.id });

    const [hidden, notMine, notMineToCatchUp, notMineToOpen, onPace] = await Promise.all([
      other.api.get(`/v1/study-sessions/${today.id}`),
      other.api.get(`/v1/today?goalId=${goal.id}`),
      other.api.post(`/v1/study-sessions/${today.id}/catch-up-blocks`, {
        data: { timeZone: "UTC" },
      }),
      other.api.post(`/v1/goals/${goal.id}/study-sessions`, {
        data: { shownDate: today.localDate, timeZone: "UTC" },
      }),
      api.post(`/v1/study-sessions/${today.id}/catch-up-blocks`, { data: { timeZone: "UTC" } }),
    ]);

    expect([
      hidden.status(),
      notMine.status(),
      notMineToCatchUp.status(),
      notMineToOpen.status(),
    ]).toStrictEqual([404, 404, 404, 404]);

    expect(today.catchUp).toBeNull();
    expect(onPace.status()).toBe(422);

    await expect(onPace.json()).resolves.toMatchObject({ error: { code: "NOTHING_TO_CATCH_UP" } });

    const stopped = await readBody({
      response: await api.post(`/v1/study-sessions/${today.id}/stops`, { data: {} }),
      schema: studySessionSummaryResponseSchema,
    });

    expect(stopped).toMatchObject({
      extraTime: { available: false, reason: "sessionNotFinished" },
      finished: false,
    });

    const { session: after } = await readBody({
      response: await api.get(`/v1/today?goalId=${goal.id}`),
      schema: todayResponseSchema,
    });

    expect(after.status).not.toBe("unstarted");
    expect(after).toMatchObject({ nextBlockId: today.blocks[0]?.id });
  });

  test("reads milestones and hides another learner's acknowledgment", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "study-milestones" });

    const milestone = await prisma.milestone.create({
      data: { key: "star", kind: "glasses", userId },
    });

    const listed = await readBody({
      response: await api.get("/v1/me/milestones"),
      schema: milestoneListResponseSchema,
    });

    expect(listed.ceremony?.id).toBe(milestone.id);

    const viewed = await api.post(`/v1/me/milestones/${milestone.id}/views`);
    expect(viewed.status()).toBe(200);

    const stranger = await userFixture();

    const strangerMilestone = await prisma.milestone.create({
      data: { key: "badge", kind: "badge", userId: stranger.id },
    });

    const hidden = await api.post(`/v1/me/milestones/${strangerMilestone.id}/views`);

    expect(hidden.status()).toBe(404);
  });
});
