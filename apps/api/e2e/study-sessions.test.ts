import { randomUUID } from "node:crypto";
import { type APIRequestContext, request } from "@playwright/test";
import { studyBlockCompletionSchema } from "@zoonk/core/sessions/completion-contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { goalFixture, planFixture, planItemFixture } from "@zoonk/testing/fixtures/goals";
import { learnerSkillFixture, mistakeFixture } from "@zoonk/testing/fixtures/learner";
import { learningEventFixture } from "@zoonk/testing/fixtures/learning-events";
import { learningProfileFixture } from "@zoonk/testing/fixtures/learning-profiles";
import { libraryChapterFixture } from "@zoonk/testing/fixtures/library-chapters";
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
  studySessionResponseSchema,
} from "../src/lib/openapi/schemas/study-sessions";
import { todayResponseSchema } from "../src/lib/openapi/schemas/today";
import { weeklyChallengeResponseSchema } from "../src/lib/openapi/schemas/weekly-challenge";
import { createBearerLearner } from "./helpers/bearer";
import { openStudyDay } from "./helpers/open-study-day";
import { readBody } from "./helpers/response";

const DAY_MS = 86_400_000;
const CHALLENGE_QUESTIONS = 5;

/** No goal means starting these blocks cannot schedule content generation. */
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

  return { goal, lessons, skills };
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
      api.post(`/v1/study-sessions/${id}/catch-up-blocks`, { data: { timeZone: "UTC" } }),
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

    const today = await openStudyDay({ api, goalId: goal.id });

    expect(today.blocks.map((block) => block.kind)).toStrictEqual(["review", "learn", "practice"]);
    expect(today.missions.map((mission) => mission.kind)).toStrictEqual(["review", "somethingNew"]);

    expect(today.blocks[1]).toMatchObject({
      canDo: "You'll compare ratios",
      lessonId: lessons[1]?.id,
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

    // The lesson taught its skill, so "10 more minutes" has questions to practice.
    await learnerSkillFixture({ reps: 1, skillId: skills[1]?.id ?? "", state: "learning", userId });

    const extra = await readBody({
      response: await api.post(`/v1/study-sessions/${today.id}/extra-blocks`),
      schema: studyBlockSchema,
      status: 201,
    });

    expect(extra).toMatchObject({ extra: true, kind: "practice", status: "pending" });
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

    // On pace, the session has nothing to catch up, and says so instead of adding anything.
    expect(today.catchUp).toBeNull();
    expect(onPace.status()).toBe(422);

    await expect(onPace.json()).resolves.toMatchObject({ error: { code: "NOTHING_TO_CATCH_UP" } });

    const stopped = await readBody({
      response: await api.post(`/v1/study-sessions/${today.id}/stops`, { data: {} }),
      schema: studySessionSummaryResponseSchema,
    });

    // Nothing is skipped: the rest of the session waits to be picked up.
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

  // rafa3 (Câmara, free, day 12): Today said Plus opens new lessons, yet "Catch up today" added
  // 205 of them, and bonus time and the phase challenge stayed open.
  test("holds catch-up, bonus time, challenges, test-outs and writing ahead for Plus once a free exam plan's first week is over", async () => {
    const { api, userId } = await createBearerLearner({ baseURL, prefix: "study-free-week" });

    const goal = await goalFixture({
      createdAt: new Date(Date.now() - 10 * DAY_MS),
      kind: "exam",
      timezone: "UTC",
      userId,
    });

    const plan = await planFixture({ goalId: goal.id });

    const [boss, session] = await Promise.all([
      planItemFixture({ kind: "boss", phase: 0, planId: plan.id, position: 0 }),
      studySessionFixture({ goalId: goal.id, userId }),
      learningProfileFixture({ activeGoalId: goal.id, userId }),
    ]);

    const sessionPath = `/v1/study-sessions/${session.id}`;
    const plusRequired = { error: { code: "PLUS_REQUIRED" } };

    const catchUp = await api.post(`${sessionPath}/catch-up-blocks`, { data: { timeZone: "UTC" } });

    expect(catchUp.status()).toBe(402);
    await expect(catchUp.json()).resolves.toMatchObject(plusRequired);

    const extra = await api.post(`${sessionPath}/extra-blocks`);

    expect(extra.status()).toBe(409);

    await expect(extra.json()).resolves.toMatchObject({
      error: { code: "EXTRA_TIME_UNAVAILABLE", details: { reason: "plusRequired" } },
    });

    const challenge = await api.get(`/v1/challenges/${boss.id}`);
    await expect(challenge.json()).resolves.toMatchObject({ status: "plusRequired" });

    const start = await api.post(`/v1/challenges/${boss.id}/starts`, { data: {} });

    expect(start.status()).toBe(402);
    await expect(start.json()).resolves.toMatchObject(plusRequired);

    const writing = await api.post(`/v1/challenges/${boss.id}/generations`);

    expect(writing.status()).toBe(402);
    await expect(writing.json()).resolves.toMatchObject(plusRequired);

    // A chapter's test-out takes the learner past lessons only Plus opens: nothing is written,
    // graded or skipped.
    const chapter = await libraryChapterFixture();
    const testOutPath = `/v1/goals/${goal.id}/chapters/${chapter.id}/test-out`;

    const testOutResponses = await Promise.all([
      api.get(testOutPath),
      api.post(`${testOutPath}/generations`),
      api.post(testOutPath, {
        data: {
          answers: [{ answer: { selectedIndex: 0 }, durationMs: 4000, itemId: randomUUID() }],
        },
      }),
    ]);

    await Promise.all(
      testOutResponses.map(async (response) => {
        expect(response.status()).toBe(402);
        await expect(response.json()).resolves.toMatchObject(plusRequired);
      }),
    );

    // Nothing is written ahead for it: no lessons, outlines or questions.
    const preparation = await api.post(`${sessionPath}/preparations`);

    expect(preparation.status()).toBe(202);
    await expect(preparation.json()).resolves.toStrictEqual({ preparationId: null });

    // Nothing joined the day and nothing was written or counted.
    await expect(
      prisma.studySessionBlock.count({ where: { sessionId: session.id } }),
    ).resolves.toBe(0);

    await expect(prisma.usageRecord.count({ where: { userId } })).resolves.toBe(0);
    await api.dispose();
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
    // Reading the buddy never builds today's session, so there are no missions yet.
    expect(buddy).toMatchObject({
      buddy: { glasses: "round", kind: "zu", name: null, picked: false },
      stage: "baby",
      today: null,
    });

    expect(challenge).toStrictEqual({ challenge: null });

    const stranger = await userFixture();

    const strangerMilestone = await prisma.milestone.create({
      data: { key: "badge", kind: "badge", userId: stranger.id },
    });

    const hidden = await api.post(`/v1/me/milestones/${strangerMilestone.id}/views`);

    expect(hidden.status()).toBe(404);
  });
});
