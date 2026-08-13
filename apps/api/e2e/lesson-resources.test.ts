import { randomUUID } from "node:crypto";
import { type APIRequestContext, request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { createOrganization, getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { createAuthenticatedApiContext } from "./helpers/auth";

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

  test("requires authentication for learner mutations", async () => {
    const { lesson } = await createPublishedLesson({});
    const apiContext: APIRequestContext = await request.newContext({ baseURL });

    const [startResponse, completionResponse, preloadResponse] = await Promise.all([
      apiContext.post(`/v1/lessons/${lesson.id}/starts`),
      apiContext.post(`/v1/lessons/${lesson.id}/completions`, {
        data: { answers: {}, startedAt: Date.now(), stepTimings: {}, timeZone: "UTC" },
      }),
      apiContext.post(`/v1/lessons/${lesson.id}/preloads`),
    ]);

    expect(startResponse.status()).toBe(401);
    expect(completionResponse.status()).toBe(401);
    expect(preloadResponse.status()).toBe(401);

    await apiContext.dispose();
  });
});
