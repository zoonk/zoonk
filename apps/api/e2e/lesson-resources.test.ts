import { randomUUID } from "node:crypto";
import { type APIRequestContext, request } from "@playwright/test";
import { MAX_LESSON_QUESTION_THREAD_TURNS } from "@zoonk/core/lesson-questions/contract";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { createAuthenticatedApiContext } from "./helpers/auth";

const EXHAUSTED_GENERATION_QUOTA_COUNT = 1_000_000;
const FIRST_OVERSIZED_ANSWER_ITEM_COUNT = 51;
const FIRST_OVERSIZED_ANSWER_TEXT_LENGTH = 501;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function getUtcDayStart(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/** Prevents a test starting just before UTC midnight from reaching the paid provider after reset. */
async function exhaustLessonQuestionGenerationQuota(userId: string): Promise<Date> {
  const currentPeriodStart = getUtcDayStart(new Date());
  const nextPeriodStart = new Date(currentPeriodStart.getTime() + MILLISECONDS_PER_DAY);

  await prisma.generationQuotaCounter.createMany({
    data: [currentPeriodStart, nextPeriodStart].map((periodStart) => ({
      actorKey: `user:${userId}`,
      count: EXHAUSTED_GENERATION_QUOTA_COUNT,
      period: "day" as const,
      periodStart,
      resource: "lessonQuestion" as const,
    })),
  });

  return currentPeriodStart;
}

/**
 * Creates an API context that authenticates exactly like a native client. The
 * shared auth helper signs in with cookies first so this helper can extract the
 * Better Auth bearer token and discard the browser-style cookie context.
 */
async function createBearerApiContext({ baseURL, prefix }: { baseURL: string; prefix: string }) {
  const authenticated = await createAuthenticatedApiContext({ baseURL, prefix });
  await authenticated.apiContext.dispose();

  const apiContext = await request.newContext({
    baseURL,
    extraHTTPHeaders: { Authorization: `Bearer ${authenticated.token}` },
  });

  return { apiContext, user: authenticated.user };
}

async function createSubscriberApiContext({
  baseURL,
  prefix,
}: {
  baseURL: string;
  prefix: string;
}) {
  const authenticated = await createBearerApiContext({ baseURL, prefix });

  await prisma.subscription.create({
    data: { plan: "plus", provider: "zoonk", referenceId: authenticated.user.id, status: "active" },
  });

  return authenticated;
}

/**
 * Creates a public AI curriculum path because player reads and writes must be
 * exercised against the same published resources used by real learners.
 */
async function createPublishedLesson({
  chapterPosition = 0,
  generationStatus = "completed",
  lessonPosition = 0,
}: {
  chapterPosition?: number;
  generationStatus?: "completed" | "failed" | "pending" | "running";
  lessonPosition?: number;
}) {
  const organization = await getAiOrganization();
  const uniqueId = randomUUID().slice(0, 8);

  const course = await courseFixture({
    isPublished: true,
    organizationId: organization.id,
    title: `E2E Lesson Resource ${uniqueId}`,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: organization.id,
    position: chapterPosition,
    title: `E2E Lesson Chapter ${uniqueId}`,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    generationStatus,
    isPublished: true,
    kind: "explanation",
    organizationId: organization.id,
    position: lessonPosition,
    title: `E2E Lesson ${uniqueId}`,
  });

  return { chapter, course, lesson, organization };
}

/**
 * Creates a published two-lesson curriculum outside the public brand catalog
 * so the HTTP boundary can prove raw lesson IDs do not bypass Core ownership.
 */
async function createRestrictedLessonPair({
  organizationId,
  userId,
}: {
  organizationId: string | null;
  userId?: string;
}) {
  const course = await courseFixture({ isPublished: true, organizationId, userId });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId,
    position: 0,
  });

  const [lesson, nextLesson] = await Promise.all([
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId,
      position: 0,
    }),
    lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId,
      position: 1,
    }),
  ]);

  return { lesson, nextLesson };
}

test.describe("Lesson resources API", () => {
  let baseURL: string;

  test.beforeAll(() => {
    baseURL = process.env.E2E_BASE_URL ?? "";
  });

  test.afterAll(async () => {
    await prisma.$disconnect();
  });

  test("returns serialized playable content without page-level catalog data", async () => {
    const { lesson } = await createPublishedLesson({});
    const content = { text: "Focused lesson content", title: "Focused lesson", variant: "text" };

    const step = await stepFixture({
      content,
      isPublished: true,
      kind: "static",
      lessonId: lesson.id,
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/lessons/${lesson.id}/content`);

    expect(response.status()).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      lesson: {
        id: lesson.id,
        steps: [{ content, fillBlankOptions: [], id: step.id, kind: "static" }],
      },
      status: "ready",
    });

    await apiContext.dispose();
  });

  test("returns the structural lesson after the requested lesson", async () => {
    const { chapter, lesson, organization } = await createPublishedLesson({});

    const nextLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "quiz",
      organizationId: organization.id,
      position: 1,
      title: `E2E Successor ${randomUUID()}`,
    });

    const apiContext = await request.newContext({ baseURL });
    const response = await apiContext.get(`/v1/lessons/${lesson.id}/next-lesson`);

    expect(response.status()).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      lesson: { chapterId: chapter.id, lessonId: nextLesson.id, lessonKind: "quiz" },
    });

    await apiContext.dispose();
  });

  test("does not expose school or another learner's personal curriculum by lesson ID", async () => {
    const organization = await createOrganization({ kind: "school" });
    const owner = await userFixture();

    const [schoolCurriculum, personalCurriculum] = await Promise.all([
      createRestrictedLessonPair({ organizationId: organization.id }),
      createRestrictedLessonPair({ organizationId: null, userId: owner.id }),
    ]);

    const guestContext = await request.newContext({ baseURL });

    const { apiContext: otherUserContext } = await createBearerApiContext({
      baseURL,
      prefix: "lesson-read-other-user",
    });

    const responses = await Promise.all([
      guestContext.get(`/v1/lessons/${schoolCurriculum.lesson.id}/content`),
      guestContext.get(`/v1/lessons/${schoolCurriculum.lesson.id}/next-lesson`),
      otherUserContext.get(`/v1/lessons/${personalCurriculum.lesson.id}/content`),
      otherUserContext.get(`/v1/lessons/${personalCurriculum.lesson.id}/next-lesson`),
    ]);

    expect(responses.map((response) => response.status())).toStrictEqual([404, 404, 404, 404]);

    await Promise.all([guestContext.dispose(), otherUserContext.dispose()]);
  });

  test("returns personal curriculum content and successors to its owner", async () => {
    const { apiContext, user } = await createBearerApiContext({
      baseURL,
      prefix: "lesson-read-owner",
    });

    const { lesson, nextLesson } = await createRestrictedLessonPair({
      organizationId: null,
      userId: user.id,
    });

    const [contentResponse, successorResponse] = await Promise.all([
      apiContext.get(`/v1/lessons/${lesson.id}/content`),
      apiContext.get(`/v1/lessons/${lesson.id}/next-lesson`),
    ]);

    expect(contentResponse.status()).toBe(200);
    expect(successorResponse.status()).toBe(200);

    await expect(successorResponse.json()).resolves.toMatchObject({
      lesson: { lessonId: nextLesson.id },
    });

    await apiContext.dispose();
  });

  test("records an idempotent lesson start for a bearer-authenticated learner", async () => {
    const { course, lesson } = await createPublishedLesson({});
    const { apiContext, user } = await createBearerApiContext({ baseURL, prefix: "lesson-start" });

    const firstResponse = await apiContext.post(`/v1/lessons/${lesson.id}/starts`);
    const secondResponse = await apiContext.post(`/v1/lessons/${lesson.id}/starts`);

    expect(firstResponse.status()).toBe(204);
    expect(secondResponse.status()).toBe(204);

    const [lessonProgressCount, courseUserCount] = await Promise.all([
      prisma.lessonProgress.count({ where: { lessonId: lesson.id, userId: user.id } }),
      prisma.courseUser.count({ where: { courseId: course.id, userId: user.id } }),
    ]);

    expect(lessonProgressCount).toBe(1);
    expect(courseUserCount).toBe(1);

    await apiContext.dispose();
  });

  test("lets an authenticated learner read and create first-chapter questions", async () => {
    const { lesson } = await createPublishedLesson({});

    const { apiContext, user } = await createBearerApiContext({
      baseURL,
      prefix: "lesson-question-subscription",
    });

    const threadResponse = await apiContext.get(`/v1/lessons/${lesson.id}/questions`);

    expect(threadResponse.status()).toBe(200);
    await expect(threadResponse.json()).resolves.toBeNull();

    const createResponse = await apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
      data: {
        context: { kind: "lesson" },
        question: "Can you explain this lesson?",
        requestId: randomUUID(),
      },
    });

    expect(createResponse.status()).toBe(201);

    await expect(
      prisma.lessonQuestionThread.count({ where: { lessonId: lesson.id, userId: user.id } }),
    ).resolves.toBe(1);

    await apiContext.dispose();
  });

  test("creates and resumes a private lesson question thread", async () => {
    const { lesson } = await createPublishedLesson({});

    const { apiContext } = await createSubscriberApiContext({
      baseURL,
      prefix: "lesson-questions",
    });

    const question = `How does this connect ${randomUUID()}?`;
    const requestId = randomUUID();

    const emptyThreadResponse = await apiContext.get(`/v1/lessons/${lesson.id}/questions`);

    expect(emptyThreadResponse.status()).toBe(200);
    await expect(emptyThreadResponse.json()).resolves.toBeNull();

    const createResponse = await apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
      data: { context: { kind: "lesson" }, question, requestId },
    });

    expect(createResponse.status()).toBe(201);

    const createdQuestion = await createResponse.json();

    expect(createdQuestion).toMatchObject({
      answer: null,
      context: { kind: "lesson" },
      id: expect.any(String),
      question,
      status: "pending",
    });

    const questionResponse = await apiContext.get(`/v1/questions/${createdQuestion.id}`);

    expect(questionResponse.status()).toBe(200);
    await expect(questionResponse.json()).resolves.toStrictEqual(createdQuestion);

    const replayResponse = await apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
      data: { context: { kind: "lesson" }, question, requestId },
    });

    expect(replayResponse.status()).toBe(201);
    await expect(replayResponse.json()).resolves.toStrictEqual(createdQuestion);

    const conflictingResponse = await apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
      data: { context: { kind: "lesson" }, question: `${question} differently`, requestId },
    });

    expect(conflictingResponse.status()).toBe(409);

    await expect(conflictingResponse.json()).resolves.toMatchObject({
      error: { code: "CONFLICT" },
    });

    const resumedThreadResponse = await apiContext.get(`/v1/lessons/${lesson.id}/questions`);

    expect(resumedThreadResponse.status()).toBe(200);

    await expect(resumedThreadResponse.json()).resolves.toMatchObject({
      id: expect.any(String),
      lessonId: lesson.id,
      questions: [createdQuestion],
    });

    await prisma.lessonQuestion.update({
      data: { answer: "A durable answer", status: "completed" },
      where: { id: createdQuestion.id },
    });

    const completedAnswerResponse = await apiContext.post(
      `/v1/questions/${createdQuestion.id}/answers`,
    );

    expect(completedAnswerResponse.status()).toBe(409);

    await expect(completedAnswerResponse.json()).resolves.toMatchObject({
      error: { code: "CONFLICT" },
    });

    await apiContext.dispose();
  });

  test("creates only one unfinished turn from concurrent question requests", async () => {
    const { lesson } = await createPublishedLesson({});

    const { apiContext, user } = await createSubscriberApiContext({
      baseURL,
      prefix: "lesson-question-create-order",
    });

    const responses = await Promise.all([
      apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
        data: {
          context: { kind: "lesson" },
          question: "First concurrent question",
          requestId: randomUUID(),
        },
      }),
      apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
        data: {
          context: { kind: "lesson" },
          question: "Second concurrent question",
          requestId: randomUUID(),
        },
      }),
    ]);

    expect(
      responses
        .map((response) => response.status())
        .toSorted((firstStatus, secondStatus) => firstStatus - secondStatus),
    ).toStrictEqual([201, 409]);

    const createdResponse = responses.find((response) => response.status() === 201);
    const conflictResponse = responses.find((response) => response.status() === 409);

    if (!createdResponse || !conflictResponse) {
      throw new Error("Expected one created and one conflicting lesson question");
    }

    const createdQuestion = await createdResponse.json();

    await expect(conflictResponse.json()).resolves.toMatchObject({ error: { code: "CONFLICT" } });

    await expect(
      prisma.lessonQuestion.findMany({
        where: { thread: { lessonId: lesson.id, userId: user.id } },
      }),
    ).resolves.toMatchObject([{ id: createdQuestion.id, status: "pending" }]);

    await apiContext.dispose();
  });

  test("paginates older lesson questions with an opaque cursor", async () => {
    const { lesson } = await createPublishedLesson({});

    const { apiContext } = await createSubscriberApiContext({
      baseURL,
      prefix: "lesson-question-pagination",
    });

    const createResponse = await apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
      data: { context: { kind: "lesson" }, question: "Question 1", requestId: randomUUID() },
    });

    expect(createResponse.status()).toBe(201);

    const createdQuestion = await createResponse.json();

    const storedQuestion = await prisma.lessonQuestion.findUniqueOrThrow({
      where: { id: createdQuestion.id },
    });

    const firstCreatedAt = new Date("2026-01-01T00:00:00.000Z");
    const totalQuestionCount = MAX_LESSON_QUESTION_THREAD_TURNS + 5;

    const contextSnapshot = {
      chapter: { description: null, title: "History chapter" },
      course: { description: null, language: "en", targetLanguage: null, title: "History course" },
      lesson: { description: null, kind: "explanation", language: "en", title: "History lesson" },
      lessonSteps: [],
      scope: { kind: "lesson" },
      step: null,
      version: 1,
    };

    await prisma.$transaction([
      prisma.lessonQuestion.update({
        data: {
          answer: "Answer 1",
          createdAt: firstCreatedAt,
          status: "completed",
          updatedAt: firstCreatedAt,
        },
        where: { id: storedQuestion.id },
      }),
      prisma.lessonQuestion.createMany({
        data: Array.from({ length: totalQuestionCount - 1 }, (_, index) => {
          const questionNumber = index + 2;
          const createdAt = new Date(firstCreatedAt.getTime() + questionNumber * 1000);

          return {
            answer: `Answer ${questionNumber}`,
            contextKind: "lesson" as const,
            contextSnapshot,
            createdAt,
            question: `Question ${questionNumber}`,
            requestFingerprint: `pagination-question-${questionNumber}`,
            requestId: randomUUID(),
            status: "completed" as const,
            threadId: storedQuestion.threadId,
            updatedAt: createdAt,
          };
        }),
      }),
    ]);

    const latestResponse = await apiContext.get(`/v1/lessons/${lesson.id}/questions`);

    expect(latestResponse.status()).toBe(200);
    const latestPage = await latestResponse.json();

    expect(latestPage).toMatchObject({ hasMore: true, nextCursor: expect.any(String) });

    expect(
      latestPage.questions.map((question: { question: string }) => question.question),
    ).toStrictEqual(
      Array.from(
        { length: MAX_LESSON_QUESTION_THREAD_TURNS },
        (_, index) => `Question ${index + 6}`,
      ),
    );

    const earlierResponse = await apiContext.get(
      `/v1/lessons/${lesson.id}/questions?cursor=${latestPage.nextCursor}`,
    );

    expect(earlierResponse.status()).toBe(200);

    await expect(earlierResponse.json()).resolves.toMatchObject({
      hasMore: false,
      nextCursor: null,
      questions: Array.from({ length: 5 }, (_, index) => ({ question: `Question ${index + 1}` })),
    });

    const invalidCursorResponse = await apiContext.get(
      `/v1/lessons/${lesson.id}/questions?cursor=${randomUUID()}`,
    );

    expect(invalidCursorResponse.status()).toBe(400);

    await expect(invalidCursorResponse.json()).resolves.toMatchObject({
      error: { code: "BAD_REQUEST" },
    });

    await apiContext.dispose();
  });

  test("rechecks paid lesson access before answering a saved question", async () => {
    const { lesson } = await createPublishedLesson({ chapterPosition: 1 });

    const { apiContext, user } = await createSubscriberApiContext({
      baseURL,
      prefix: "lesson-question-expired-subscription",
    });

    const createResponse = await apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
      data: {
        context: { kind: "lesson" },
        question: "Can you explain this paid lesson?",
        requestId: randomUUID(),
      },
    });

    expect(createResponse.status()).toBe(201);

    const createdQuestion = await createResponse.json();

    await prisma.subscription.updateMany({
      data: { status: "canceled" },
      where: { referenceId: user.id },
    });

    const [questionResponse, answerResponse] = await Promise.all([
      apiContext.get(`/v1/questions/${createdQuestion.id}`),
      apiContext.post(`/v1/questions/${createdQuestion.id}/answers`),
    ]);

    expect(questionResponse.status()).toBe(402);
    expect(answerResponse.status()).toBe(402);

    await expect(answerResponse.json()).resolves.toMatchObject({
      error: { code: "PAYMENT_REQUIRED" },
    });

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: createdQuestion.id } }),
    ).resolves.toMatchObject({ generationRevision: 0, status: "pending" });

    await apiContext.dispose();
  });

  test("creates a question from a server-validated correct answer", async () => {
    const { lesson } = await createPublishedLesson({});

    const { apiContext } = await createSubscriberApiContext({
      baseURL,
      prefix: "lesson-question-correct-answer",
    });

    const step = await stepFixture({
      content: {
        options: [
          { feedback: "Correct", id: "correct", isCorrect: true, text: "Correct" },
          { feedback: "Try again", id: "incorrect", isCorrect: false, text: "Incorrect" },
        ],
        question: "Choose the correct answer",
      },
      isPublished: true,
      kind: "multipleChoice",
      lessonId: lesson.id,
    });

    const response = await apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
      data: {
        context: {
          answer: { kind: "multipleChoice", selectedOptionId: "correct" },
          kind: "answer",
          stepId: step.id,
          stepNumber: 1,
        },
        question: "Why is this answer correct?",
        requestId: randomUUID(),
      },
    });

    expect(response.status()).toBe(201);
    const question = await response.json();

    expect(question).toMatchObject({ context: { kind: "answer", stepId: step.id, stepNumber: 1 } });

    await expect(
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: question.id } }),
    ).resolves.toMatchObject({
      contextKind: "answer",
      contextSnapshot: {
        answer: {
          correctAnswer: "Correct",
          feedback: "Correct",
          isCorrect: true,
          selectedAnswer: "Correct",
        },
        scope: { kind: "answer" },
      },
    });

    await prisma.lessonQuestion.update({
      data: { contextSnapshot: { corruptedForResourceRead: true } },
      where: { id: question.id },
    });

    const questionResponse = await apiContext.get(`/v1/questions/${question.id}`);

    expect(questionResponse.status()).toBe(200);

    await expect(questionResponse.json()).resolves.toMatchObject({
      context: { kind: "answer", stepId: step.id, stepNumber: 1 },
      id: question.id,
    });

    await apiContext.dispose();
  });

  test("rejects oversized and fabricated selected answers before persistence", async () => {
    const { lesson } = await createPublishedLesson({});

    const { apiContext, user } = await createSubscriberApiContext({
      baseURL,
      prefix: "lesson-question-answer-bounds",
    });

    const step = await stepFixture({
      content: {
        options: [
          { feedback: "Correct", id: "correct", isCorrect: true, text: "Correct" },
          { feedback: "Try again", id: "incorrect", isCorrect: false, text: "Incorrect" },
        ],
        question: "Choose the correct answer",
      },
      isPublished: true,
      kind: "multipleChoice",
      lessonId: lesson.id,
    });

    const [oversizedTextResponse, oversizedItemsResponse, fabricatedOptionResponse] =
      await Promise.all([
        apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
          data: {
            context: {
              answer: {
                kind: "multipleChoice",
                selectedOptionId: "x".repeat(FIRST_OVERSIZED_ANSWER_TEXT_LENGTH),
              },
              kind: "answer",
              stepId: step.id,
              stepNumber: 1,
            },
            question: "Why was this wrong?",
            requestId: randomUUID(),
          },
        }),
        apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
          data: {
            context: {
              answer: {
                arrangedWords: Array.from(
                  { length: FIRST_OVERSIZED_ANSWER_ITEM_COUNT },
                  () => "word",
                ),
                kind: "reading",
              },
              kind: "answer",
              stepId: step.id,
              stepNumber: 1,
            },
            question: "Why was this arrangement wrong?",
            requestId: randomUUID(),
          },
        }),
        apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
          data: {
            context: {
              answer: { kind: "multipleChoice", selectedOptionId: "not-a-displayed-option" },
              kind: "answer",
              stepId: step.id,
              stepNumber: 1,
            },
            question: "Why was this fabricated option wrong?",
            requestId: randomUUID(),
          },
        }),
      ]);

    expect(oversizedTextResponse.status()).toBe(400);
    expect(oversizedItemsResponse.status()).toBe(400);
    expect(fabricatedOptionResponse.status()).toBe(422);

    const validationErrorBodies = await Promise.all(
      [oversizedTextResponse, oversizedItemsResponse].map((response) => response.json()),
    );

    for (const body of validationErrorBodies) {
      expect(body).toMatchObject({ error: { code: "VALIDATION_ERROR" } });
    }

    await expect(fabricatedOptionResponse.json()).resolves.toMatchObject({
      error: { code: "UNPROCESSABLE_ENTITY" },
    });

    await expect(
      prisma.lessonQuestionThread.findUnique({
        where: { userLessonQuestionThread: { lessonId: lesson.id, userId: user.id } },
      }),
    ).resolves.toBeNull();

    await apiContext.dispose();
  });

  test("limits concurrent lesson question answers before provider generation", async () => {
    const { chapter, lesson, organization } = await createPublishedLesson({});

    const secondLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      organizationId: organization.id,
      position: 1,
    });

    const { apiContext, user } = await createSubscriberApiContext({
      baseURL,
      prefix: "lesson-question-generation-limit",
    });

    const firstQuestionResponse = await apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
      data: {
        context: { kind: "lesson" },
        question: "Can you explain the first idea?",
        requestId: randomUUID(),
      },
    });

    const secondQuestionResponse = await apiContext.post(
      `/v1/lessons/${secondLesson.id}/questions`,
      {
        data: {
          context: { kind: "lesson" },
          question: "Can you explain the second idea?",
          requestId: randomUUID(),
        },
      },
    );

    expect(firstQuestionResponse.status()).toBe(201);
    expect(secondQuestionResponse.status()).toBe(201);

    const [firstQuestion, secondQuestion] = await Promise.all([
      firstQuestionResponse.json(),
      secondQuestionResponse.json(),
    ]);

    const periodStart = await exhaustLessonQuestionGenerationQuota(user.id);

    const answerResponses = await Promise.all([
      apiContext.post(`/v1/questions/${firstQuestion.id}/answers`),
      apiContext.post(`/v1/questions/${secondQuestion.id}/answers`),
    ]);

    expect(answerResponses.map((response) => response.status())).toStrictEqual([429, 429]);

    const answerBodies = await Promise.all(answerResponses.map((response) => response.json()));

    for (const body of answerBodies) {
      expect(body).toStrictEqual({
        error: {
          code: "GENERATION_LIMIT_REACHED",
          details: { period: "day", resource: "lessonQuestion", viewer: "subscriber" },
          message: "Generation limit reached",
        },
      });
    }

    const [persistedCounter, persistedQuestions, quotaClaims] = await Promise.all([
      prisma.generationQuotaCounter.findUniqueOrThrow({
        where: {
          generationQuotaCounter: {
            actorKey: `user:${user.id}`,
            period: "day",
            periodStart,
            resource: "lessonQuestion",
          },
        },
      }),
      prisma.lessonQuestion.findMany({
        where: { id: { in: [firstQuestion.id, secondQuestion.id] } },
      }),
      prisma.generationQuotaClaim.findMany({
        where: {
          resource: "lessonQuestion",
          targetId: { in: [firstQuestion.id, secondQuestion.id] },
        },
      }),
    ]);

    expect(persistedCounter.count).toBe(EXHAUSTED_GENERATION_QUOTA_COUNT);
    expect(persistedQuestions).toHaveLength(2);

    for (const question of persistedQuestions) {
      expect(question).toMatchObject({
        answer: null,
        generationRevision: 1,
        model: null,
        provider: null,
        status: "failed",
      });
    }

    expect(quotaClaims).toStrictEqual([]);

    await apiContext.dispose();
  });

  test("does not answer a later turn while an earlier turn is unfinished", async () => {
    const { lesson } = await createPublishedLesson({});

    const { apiContext, user } = await createSubscriberApiContext({
      baseURL,
      prefix: "lesson-question-answer-order",
    });

    const firstCreateResponse = await apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
      data: {
        context: { kind: "lesson" },
        question: "First ordered question",
        requestId: randomUUID(),
      },
    });

    expect(firstCreateResponse.status()).toBe(201);
    const firstQuestion = await firstCreateResponse.json();

    await prisma.lessonQuestion.update({
      data: { answer: "Temporary completed answer", status: "completed" },
      where: { id: firstQuestion.id },
    });

    const secondCreateResponse = await apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
      data: {
        context: { kind: "lesson" },
        question: "Second ordered question",
        requestId: randomUUID(),
      },
    });

    expect(secondCreateResponse.status()).toBe(201);
    const secondQuestion = await secondCreateResponse.json();

    await prisma.lessonQuestion.update({
      data: { answer: null, status: "pending" },
      where: { id: firstQuestion.id },
    });

    await exhaustLessonQuestionGenerationQuota(user.id);

    const [firstAnswerResponse, secondAnswerResponse] = await Promise.all([
      apiContext.post(`/v1/questions/${firstQuestion.id}/answers`),
      apiContext.post(`/v1/questions/${secondQuestion.id}/answers`),
    ]);

    expect(firstAnswerResponse.status()).toBe(429);
    expect(secondAnswerResponse.status()).toBe(409);

    await expect(firstAnswerResponse.json()).resolves.toMatchObject({
      error: { code: "GENERATION_LIMIT_REACHED", details: { resource: "lessonQuestion" } },
    });

    await expect(secondAnswerResponse.json()).resolves.toMatchObject({
      error: { code: "CONFLICT" },
    });

    const [storedFirstQuestion, storedSecondQuestion] = await Promise.all([
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: firstQuestion.id } }),
      prisma.lessonQuestion.findUniqueOrThrow({ where: { id: secondQuestion.id } }),
    ]);

    expect(storedFirstQuestion).toMatchObject({ generationRevision: 1, status: "failed" });
    expect(storedSecondQuestion).toMatchObject({ generationRevision: 0, status: "pending" });

    await apiContext.dispose();
  });

  test("completes a lesson and returns the authoritative rewards", async () => {
    const { lesson } = await createPublishedLesson({});

    const step = await stepFixture({
      content: {
        options: [
          { feedback: "Correct", id: "correct", isCorrect: true, text: "Correct" },
          { feedback: "Incorrect", id: "incorrect", isCorrect: false, text: "Incorrect" },
        ],
        question: "Choose the correct answer",
      },
      isPublished: true,
      kind: "multipleChoice",
      lessonId: lesson.id,
    });

    const { apiContext, user } = await createBearerApiContext({
      baseURL,
      prefix: "lesson-completion",
    });

    const startedAt = Date.now() - 10_000;

    const data = {
      answers: { [step.id]: { kind: "multipleChoice", selectedOptionId: "correct" } },
      startedAt,
      stepTimings: {
        [step.id]: {
          answeredAt: startedAt + 5000,
          dayOfWeek: 1,
          durationSeconds: 5,
          hourOfDay: 12,
        },
      },
      timeZone: "UTC",
    };

    const response = await apiContext.post(`/v1/lessons/${lesson.id}/completions`, { data });

    expect(response.status()).toBe(200);

    const result = await response.json();

    expect(result).toMatchObject({
      belt: { belt: expect.any(String) },
      brainPower: expect.any(Number),
      correctCount: 1,
      incorrectCount: 0,
      newTotalBp: expect.any(Number),
    });

    const [attempts, lessonProgress, progress] = await Promise.all([
      prisma.stepAttempt.findMany({ where: { stepId: step.id, userId: user.id } }),
      prisma.lessonProgress.findUnique({
        where: { userLesson: { lessonId: lesson.id, userId: user.id } },
      }),
      prisma.userProgress.findUniqueOrThrow({ where: { userId: user.id } }),
    ]);

    expect(attempts).toHaveLength(1);
    expect(lessonProgress).toMatchObject({ completedAt: expect.any(Date) });
    expect(Number(progress.totalBrainPower)).toBe(result.newTotalBp);

    await apiContext.dispose();
  });

  test("starts a derived preload workflow without caller-selected targets", async () => {
    const { chapter, lesson, organization } = await createPublishedLesson({});

    const nextLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      organizationId: organization.id,
      position: 1,
      title: `E2E Preload ${randomUUID()}`,
    });

    await stepFixture({
      content: { text: "Repair this saved step", title: "Preloaded", variant: "text" },
      isPublished: true,
      kind: "static",
      lessonId: nextLesson.id,
    });

    const { apiContext } = await createBearerApiContext({ baseURL, prefix: "lesson-preload" });

    const response = await apiContext.post(`/v1/lessons/${lesson.id}/preloads`);

    expect(response.status()).toBe(202);

    await expect(response.json()).resolves.toMatchObject({
      generations: [{ generationId: expect.any(String), kind: "lesson", lessonId: nextLesson.id }],
    });

    await apiContext.dispose();
  });

  test("skips derived generation when the learner has reached the lesson limit", async () => {
    const { chapter, lesson, organization } = await createPublishedLesson({});

    const nextLesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      organizationId: organization.id,
      position: 1,
      title: `E2E Limited Preload ${randomUUID()}`,
    });

    const { apiContext, user } = await createBearerApiContext({
      baseURL,
      prefix: "lesson-preload-limit",
    });

    const now = new Date();

    const periodStart = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()),
    );

    await prisma.generationQuotaCounter.create({
      data: {
        actorKey: `user:${user.id}`,
        count: 50,
        period: "day",
        periodStart,
        resource: "lesson",
      },
    });

    const response = await apiContext.post(`/v1/lessons/${lesson.id}/preloads`);

    expect(response.status()).toBe(202);
    await expect(response.json()).resolves.toStrictEqual({ generations: [] });

    await expect(
      prisma.lesson.findUniqueOrThrow({ where: { id: nextLesson.id } }),
    ).resolves.toMatchObject({ generationRunId: null, generationStatus: "pending" });

    await apiContext.dispose();
  });

  test("requires authentication for learner history and mutations", async () => {
    const { lesson } = await createPublishedLesson({});
    const apiContext: APIRequestContext = await request.newContext({ baseURL });

    const [
      startResponse,
      completionResponse,
      preloadResponse,
      questionThreadResponse,
      questionResponse,
      answerResponse,
    ] = await Promise.all([
      apiContext.post(`/v1/lessons/${lesson.id}/starts`),
      apiContext.post(`/v1/lessons/${lesson.id}/completions`, {
        data: { answers: {}, startedAt: Date.now(), stepTimings: {}, timeZone: "UTC" },
      }),
      apiContext.post(`/v1/lessons/${lesson.id}/preloads`),
      apiContext.get(`/v1/lessons/${lesson.id}/questions`),
      apiContext.post(`/v1/lessons/${lesson.id}/questions`, {
        data: {
          context: { kind: "lesson" },
          question: "Can you explain this?",
          requestId: randomUUID(),
        },
      }),
      apiContext.post(`/v1/questions/${randomUUID()}/answers`),
    ]);

    expect(startResponse.status()).toBe(401);
    expect(completionResponse.status()).toBe(401);
    expect(preloadResponse.status()).toBe(401);
    expect(questionThreadResponse.status()).toBe(401);
    expect(questionResponse.status()).toBe(401);
    expect(answerResponse.status()).toBe(401);

    await apiContext.dispose();
  });
});
