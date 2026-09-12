import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import {
  chapterActivitiesResponseSchema,
  curriculumGenerationViewSchema,
  discoveryResponseSchema,
  discoveryStartResponseSchema,
  optionalActivitiesResponseSchema,
  optionalActivityStartResponseSchema,
} from "../src/lib/openapi/schemas/learning-discovery";
import { createAuthenticatedApiContext } from "./helpers/auth";

const DISCOVERIES = "/v1/me/course-discoveries";

const question = {
  description: "Choose the useful outcome",
  id: "outcome",
  optional: false,
  options: [{ description: "Build a prototype", id: "prototype", label: "Prototype" }],
  question: "What do you want to make?",
};

test.describe("Learning discovery API", () => {
  test("rejects private guest requests before shared prompt persistence", async () => {
    const guest = await request.newContext({ baseURL: process.env.E2E_BASE_URL });
    const prompt = `Private job and health details ${randomUUID()}`;

    const responses = await Promise.all([
      guest.post("/v1/learning-requests", { data: { language: "en", prompt } }),
      guest.post(DISCOVERIES, { data: { language: "en", prompt } }),
      guest.post("/v1/course-prompts", { data: { kind: "topic", language: "en", prompt } }),
    ]);

    for (const response of responses) {
      expect(response.status()).toBe(401);
    }

    await expect(prisma.coursePrompt.count({ where: { prompt } })).resolves.toBe(0);
    await expect(prisma.courseDiscovery.count({ where: { prompt } })).resolves.toBe(0);
    await guest.dispose();
  });

  test("enforces a resettable daily discovery budget before AI or shared prompt writes", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL: process.env.E2E_BASE_URL ?? "",
      prefix: "learning-budget",
    });

    const now = new Date();

    await prisma.generationQuotaCounter.create({
      data: {
        actorKey: `user:${user.id}`,
        count: 100,
        period: "day",
        periodStart: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())),
        resource: "learningRequest",
      },
    });

    const prompt = `Private project budget ${randomUUID()}`;

    const response = await apiContext.post("/v1/learning-requests", {
      data: { language: "en", prompt },
    });

    expect(response.status()).toBe(429);
    const discovery = await apiContext.post(DISCOVERIES, { data: { language: "en", prompt } });
    expect(discovery.status()).toBe(429);
    await expect(prisma.coursePrompt.count({ where: { prompt } })).resolves.toBe(0);

    await expect(
      prisma.courseDiscovery.findFirst({ where: { prompt, userId: user.id } }),
    ).resolves.toMatchObject({ status: "failed" });

    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      curriculumVersion: 2,
      isPublished: true,
      organizationId: organization.id,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      level: "basic",
    });

    await lessonFixture({ chapterId: chapter.id, isPublished: true, kind: "explanation" });

    await prisma.courseLearningPlan.create({
      data: {
        chapterIds: [chapter.id],
        contentRevision: course.contentRevision,
        courseId: course.id,
        depth: "focused",
        goal: "My current goal",
        userId: user.id,
      },
    });

    const planPath = `/v1/me/courses/${course.id}/learning-plan`;

    const pacing = await apiContext.put(planPath, {
      data: {
        expectedRevision: 1,
        input: { dailyMinutes: 5, depth: "focused", goal: "My current goal" },
      },
    });

    expect(pacing.status()).toBe(200);

    const changed = await apiContext.put(planPath, {
      data: {
        expectedRevision: 2,
        input: { dailyMinutes: 5, depth: "focused", goal: "A different goal" },
      },
    });

    expect(changed.status()).toBe(429);

    await expect(
      prisma.courseLearningPlan.findUnique({
        where: { userCoursePlan: { courseId: course.id, userId: user.id } },
      }),
    ).resolves.toMatchObject({ dailyMinutes: 5, goal: "My current goal", revision: 2 });

    await apiContext.dispose();
  });

  test("keeps discovery reads and correction commands owner-only and rejects stale answers", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const [owner, other, guest] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "discovery-owner" }),
      createAuthenticatedApiContext({ baseURL, prefix: "discovery-other" }),
      request.newContext({ baseURL }),
    ]);

    const discovery = await prisma.courseDiscovery.create({
      data: {
        answers: [],
        language: "en",
        nextQuestion: question,
        prompt: "Private equipment constraints",
        status: "ask",
        userId: owner.user.id,
      },
    });

    const path = `${DISCOVERIES}/${discovery.id}`;
    const read = await owner.apiContext.get(path);
    expect(read.status()).toBe(200);
    const resource = await read.json();
    expect(discoveryResponseSchema.safeParse(resource).success).toBe(true);
    expect(resource.discovery).not.toHaveProperty("userId");
    const hidden = await other.apiContext.get(path);
    expect(hidden.status()).toBe(404);
    const unsigned = await guest.get(path);
    expect(unsigned.status()).toBe(401);

    const stale = await owner.apiContext.post(`${path}/answers`, {
      data: { expectedRevision: 2, optionId: "prototype", questionId: question.id },
    });

    expect(stale.status()).toBe(409);

    const foreign = await other.apiContext.patch(path, {
      data: { answerIndex: 0, answerText: "Replace their answer", expectedRevision: 1 },
    });

    expect(foreign.status()).toBe(404);

    const invalid = await owner.apiContext.post(`${path}/answers`, {
      data: { expectedRevision: 1, optionId: "unknown", questionId: question.id },
    });

    expect(invalid.status()).toBe(422);

    await expect(
      prisma.courseDiscovery.findUnique({ where: { id: discovery.id } }),
    ).resolves.toMatchObject({ answers: [], revision: 1, status: "ask" });

    await Promise.all([owner.apiContext.dispose(), other.apiContext.dispose(), guest.dispose()]);
  });

  test("resumes a generated private course without re-running discovery or exposing its brief", async () => {
    const { apiContext, user } = await createAuthenticatedApiContext({
      baseURL: process.env.E2E_BASE_URL ?? "",
      prefix: "discovery-resume",
    });

    const course = await courseFixture({
      curriculumVersion: 2,
      discoveryBrief: { title: "Private brief" },
      format: "personalized",
      generationStatus: "completed",
      isPublished: true,
      organizationId: null,
      userId: user.id,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      generationStatus: "completed",
      isPublished: true,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
    });

    const discovery = await prisma.courseDiscovery.create({
      data: {
        answers: [],
        courseId: course.id,
        language: "en",
        prompt: "Private brief",
        status: "generating",
        userId: user.id,
      },
    });

    const response = await apiContext.post(`${DISCOVERIES}/${discovery.id}/start`, {
      data: { expectedRevision: 1 },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(discoveryStartResponseSchema.safeParse(body).success).toBe(true);

    expect(body).toMatchObject({
      nextTarget: { brandSlug: "me", courseId: course.id, lessonId: lesson.id },
      status: "ready",
    });

    const revise = await apiContext.patch(`${DISCOVERIES}/${discovery.id}`, {
      data: { answerIndex: 0, answerText: "New private constraints", expectedRevision: 1 },
    });

    expect(revise.status()).toBe(409);
    await apiContext.dispose();
  });
});

test.describe("Optional learning activities API", () => {
  test("public reads create nothing and concurrent explicit starts reuse one activity", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const [owner, guest, organization] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "optional-start" }),
      request.newContext({ baseURL }),
      organizationFixture({ kind: "brand" }),
    ]);

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
    const chapter = await chapterFixture({ courseId: course.id, isPublished: true });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
    });

    const path = `/v1/lessons/${lesson.id}/optional-activities`;
    const read = await guest.get(path);
    expect(read.status()).toBe(200);
    const list = await read.json();
    expect(optionalActivitiesResponseSchema.safeParse(list).success).toBe(true);
    await expect(prisma.lesson.count({ where: { sourceLessonId: lesson.id } })).resolves.toBe(0);

    const unsigned = await guest.post(`/v1/me/lessons/${lesson.id}/optional-activities`, {
      data: { kind: "quiz" },
    });

    expect(unsigned.status()).toBe(401);

    const responses = await Promise.all(
      [0, 1].map(() =>
        owner.apiContext.post(`/v1/me/lessons/${lesson.id}/optional-activities`, {
          data: { kind: "quiz" },
        }),
      ),
    );

    const bodies = await Promise.all(responses.map((response) => response.json()));

    for (const [index, response] of responses.entries()) {
      expect(response.status()).toBe(200);
      expect(optionalActivityStartResponseSchema.safeParse(bodies[index]).success).toBe(true);
    }

    expect(bodies[0].resourceId).toBe(bodies[1].resourceId);

    const [teachingResponse, groupedResponse] = await Promise.all([
      guest.get(`/v1/chapters/${chapter.id}/lessons?view=teaching`),
      guest.get(`/v1/chapters/${chapter.id}/optional-activities`),
    ]);

    expect(teachingResponse.status()).toBe(200);
    await expect(teachingResponse.json()).resolves.toMatchObject({ data: [{ id: lesson.id }] });
    const groups = await groupedResponse.json();
    expect(chapterActivitiesResponseSchema.safeParse(groups).success).toBe(true);
    expect(groups.groups).toHaveLength(1);

    expect(groups.groups[0]).toMatchObject({
      activities: [
        { kind: "quiz", lesson: { id: bodies[0].resourceId } },
        { kind: "practice", lesson: null },
      ],
      source: { lessonId: lesson.id },
    });

    await expect(
      prisma.lesson.count({ where: { kind: "quiz", sourceLessonId: lesson.id } }),
    ).resolves.toBe(1);

    await Promise.all([owner.apiContext.dispose(), guest.dispose()]);
  });

  test("private activities and curriculum status remain invisible outside their owner", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const [owner, other, guest] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "private-activity" }),
      createAuthenticatedApiContext({ baseURL, prefix: "other-activity" }),
      request.newContext({ baseURL }),
    ]);

    const course = await courseFixture({
      curriculumVersion: 2,
      discoveryBrief: { title: "Private constraints" },
      format: "personalized",
      generationStatus: "completed",
      isPublished: true,
      organizationId: null,
      userId: owner.user.id,
    });

    const chapter = await chapterFixture({ courseId: course.id, isPublished: true });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
    });

    const paths = [
      `/v1/lessons/${lesson.id}/optional-activities`,
      `/v1/courses/${course.id}/curriculum-generation`,
      `/v1/chapters/${chapter.id}/optional-activities`,
    ];

    const foreignResponses = await Promise.all(paths.map((path) => other.apiContext.get(path)));

    for (const foreign of foreignResponses) {
      expect(foreign.status()).toBe(404);
    }

    const read = await owner.apiContext.get(paths[1]!);
    expect(read.status()).toBe(200);
    const view = await read.json();
    expect(curriculumGenerationViewSchema.safeParse(view).success).toBe(true);
    expect(view).toMatchObject({ needsGeneration: false, status: "ready" });
    expect(view.course).not.toHaveProperty("discoveryBrief");
    const unsigned = await guest.get(paths[0]!);
    expect(unsigned.status()).toBe(404);
    const unsignedView = await guest.get(paths[1]!);
    expect(unsignedView.status()).toBe(404);

    await expect(
      prisma.generationQuotaClaim.count({ where: { actorKey: `user:${owner.user.id}` } }),
    ).resolves.toBe(0);

    await Promise.all([owner.apiContext.dispose(), other.apiContext.dispose(), guest.dispose()]);
  });
});
