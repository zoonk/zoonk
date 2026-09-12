import { randomUUID } from "node:crypto";
import { request } from "@playwright/test";
import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture, courseUserFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { startTrackResponseSchema, trackResponseSchema } from "../src/lib/openapi/schemas/tracks";
import { createAuthenticatedApiContext } from "./helpers/auth";

const TRACKS_PATH = "/v1/me/tracks";

test.describe("Current learner tracks API", () => {
  test("requires authentication for every track operation", async () => {
    const apiContext = await request.newContext({ baseURL: process.env.E2E_BASE_URL });
    const trackPath = `${TRACKS_PATH}/${randomUUID()}`;
    const input = { courseIds: [randomUUID()], title: "Science" };

    const responses = await Promise.all([
      apiContext.get(TRACKS_PATH),
      apiContext.post(TRACKS_PATH, { data: input }),
      apiContext.get(trackPath),
      apiContext.patch(trackPath, { data: { title: "Changed" } }),
      apiContext.delete(trackPath),
      apiContext.post(`${trackPath}/start`),
    ]);

    for (const response of responses) {
      expect(response.status()).toBe(401);
    }

    await apiContext.dispose();
  });

  test("requires course setup before starting an unprepared reusable Track member", async () => {
    const [{ apiContext, user }, organization] = await Promise.all([
      createAuthenticatedApiContext({
        baseURL: process.env.E2E_BASE_URL ?? "",
        prefix: "track-setup",
      }),
      getAiOrganization(),
    ]);

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const created = await apiContext.post(TRACKS_PATH, {
      data: { courseIds: [course.id], title: "My new subject" },
    });

    const track = await created.json();
    const response = await apiContext.post(`${TRACKS_PATH}/${track.id}/start`);
    const body = await response.json();

    expect(response.status()).toBe(200);
    expect(startTrackResponseSchema.safeParse(body).success).toBe(true);

    expect(body).toStrictEqual({
      brandSlug: organization.slug,
      courseId: course.id,
      courseSlug: course.slug,
      status: "needsPlan",
    });

    await expect(prisma.courseLearningPlan.count({ where: { userId: user.id } })).resolves.toBe(0);

    await expect(
      prisma.generationQuotaClaim.count({ where: { actorKey: `user:${user.id}` } }),
    ).resolves.toBe(0);

    await apiContext.dispose();
  });

  test("starts authored legacy material directly and keeps unavailable teaching incomplete", async () => {
    const [{ apiContext }, organization] = await Promise.all([
      createAuthenticatedApiContext({
        baseURL: process.env.E2E_BASE_URL ?? "",
        prefix: "track-authored",
      }),
      organizationFixture({ kind: "brand" }),
    ]);

    const course = await courseFixture({
      curriculumVersion: 1,
      isPublished: true,
      organizationId: organization.id,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
    });

    const created = await apiContext.post(TRACKS_PATH, {
      data: { courseIds: [course.id], title: "An authored subject" },
    });

    const track = await created.json();
    const startPath = `${TRACKS_PATH}/${track.id}/start`;
    const start = await apiContext.post(startPath);
    const body = await start.json();
    expect(start.status()).toBe(200);
    expect(startTrackResponseSchema.safeParse(body).success).toBe(true);

    expect(body).toMatchObject({
      needsCurriculumUpdate: false,
      needsPlan: false,
      nextTarget: { generationStatus: "completed", lessonId: lesson.id },
      status: "ready",
      supportsLearningPlan: false,
    });

    const update = await apiContext.put(`/v1/me/courses/${course.id}/learning-plan`, {
      data: { input: { depth: "overview" } },
    });

    expect(update.status()).toBe(422);

    await prisma.lesson.update({ data: { generationStatus: "pending" }, where: { id: lesson.id } });
    const unavailable = await apiContext.post(startPath);
    expect(unavailable.status()).toBe(422);
    const current = await apiContext.get(`${TRACKS_PATH}/${track.id}`);

    expect(await current.json()).toMatchObject({
      nextTarget: null,
      progress: { completedCourses: 0, totalCourses: 1 },
    });

    await apiContext.dispose();
  });

  test("creates and reorders courses without copying their identities", async () => {
    const [{ apiContext }, organization] = await Promise.all([
      createAuthenticatedApiContext({
        baseURL: process.env.E2E_BASE_URL ?? "",
        prefix: "track-order",
      }),
      organizationFixture({ kind: "brand" }),
    ]);

    const [physics, chemistry] = await Promise.all([
      courseFixture({ isPublished: true, organizationId: organization.id, title: "Physics" }),
      courseFixture({ isPublished: true, organizationId: organization.id, title: "Chemistry" }),
    ]);

    const created = await apiContext.post(TRACKS_PATH, {
      data: { courseIds: [physics.id, chemistry.id], title: "Science foundations" },
    });

    expect(created.status()).toBe(201);
    const track = await created.json();
    expect(trackResponseSchema.safeParse(track).success).toBe(true);

    expect(track).toMatchObject({
      courses: [{ id: physics.id }, { id: chemistry.id }],
      progress: { completedCourses: 0, totalCourses: 2 },
      title: "Science foundations",
    });

    expect(track).not.toHaveProperty("userId");
    expect(track.createdAt).toEqual(expect.any(String));

    const reordered = await apiContext.patch(`${TRACKS_PATH}/${track.id}`, {
      data: { courseIds: [chemistry.id, physics.id], title: "Chemistry and physics" },
    });

    expect(reordered.status()).toBe(200);

    await expect(reordered.json()).resolves.toMatchObject({
      courses: [{ id: chemistry.id }, { id: physics.id }],
      id: track.id,
      title: "Chemistry and physics",
    });

    const read = await apiContext.get(`${TRACKS_PATH}/${track.id}`);
    expect(read.status()).toBe(200);

    await expect(read.json()).resolves.toMatchObject({
      courses: [{ id: chemistry.id }, { id: physics.id }],
      title: "Chemistry and physics",
    });

    const renamed = await apiContext.patch(`${TRACKS_PATH}/${track.id}`, {
      data: { title: "Science" },
    });

    expect(renamed.status()).toBe(200);

    await expect(renamed.json()).resolves.toMatchObject({
      courses: [{ id: chemistry.id }, { id: physics.id }],
      title: "Science",
    });

    await apiContext.dispose();
  });

  test("paginates only the authenticated learner's tracks", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const [owner, other, organization] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "track-page" }),
      createAuthenticatedApiContext({ baseURL, prefix: "track-page-other" }),
      organizationFixture({ kind: "brand" }),
    ]);

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const created = await Promise.all([
      owner.apiContext.post(TRACKS_PATH, {
        data: { courseIds: [course.id], title: "First track" },
      }),
      owner.apiContext.post(TRACKS_PATH, {
        data: { courseIds: [course.id], title: "Second track" },
      }),
      other.apiContext.post(TRACKS_PATH, {
        data: { courseIds: [course.id], title: "Private other track" },
      }),
    ]);

    for (const response of created) {
      expect(response.status()).toBe(201);
    }

    const [firstTrack, secondTrack, otherTrack] = await Promise.all(
      created.map((response) => response.json()),
    );

    const first = await owner.apiContext.get(TRACKS_PATH, { params: { limit: 1 } });
    expect(first.status()).toBe(200);
    const firstPage = await first.json();
    expect(firstPage.data).toHaveLength(1);
    expect(firstPage.pagination.hasMore).toBe(true);
    expect(firstPage.pagination.nextCursor).toEqual(expect.any(String));

    const second = await owner.apiContext.get(TRACKS_PATH, {
      params: { cursor: firstPage.pagination.nextCursor, limit: 1 },
    });

    expect(second.status()).toBe(200);
    const secondPage = await second.json();
    expect(secondPage.data).toHaveLength(1);
    expect(secondPage.pagination).toEqual({ hasMore: false, nextCursor: null });

    const ids = [...firstPage.data, ...secondPage.data].map((track: { id: string }) => track.id);
    expect(new Set(ids)).toEqual(new Set([firstTrack.id, secondTrack.id]));
    expect(ids).not.toContain(otherTrack.id);

    const otherCursor = await owner.apiContext.get(TRACKS_PATH, {
      params: { cursor: otherTrack.id, limit: 1 },
    });

    expect(otherCursor.status()).toBe(200);
    const otherCursorPage = await otherCursor.json();

    expect(otherCursorPage.data).not.toEqual(
      expect.arrayContaining([expect.objectContaining({ id: otherTrack.id })]),
    );

    await Promise.all([owner.apiContext.dispose(), other.apiContext.dispose()]);
  });

  test("reports selected-path lesson progress and keeps unfinished chapter totals explicit", async () => {
    const [{ apiContext, user }, organization] = await Promise.all([
      createAuthenticatedApiContext({
        baseURL: process.env.E2E_BASE_URL ?? "",
        prefix: "track-progress",
      }),
      organizationFixture({ kind: "brand" }),
    ]);

    const course = await courseFixture({
      curriculumVersion: 2,
      format: "language",
      isPublished: true,
      organizationId: organization.id,
    });

    const chapterInput = {
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
    };

    const [earlier, current, pending] = await Promise.all([
      chapterFixture({ ...chapterInput, level: "a1", position: 0 }),
      chapterFixture({ ...chapterInput, level: "b1", position: 1 }),
      chapterFixture({ ...chapterInput, generationStatus: "pending", level: "b1", position: 2 }),
    ]);

    const lessonInput = { isPublished: true, organizationId: organization.id };

    const [completed, next] = await Promise.all([
      lessonFixture({ ...lessonInput, chapterId: current.id, kind: "vocabulary", position: 0 }),
      lessonFixture({ ...lessonInput, chapterId: current.id, kind: "reading", position: 1 }),
      lessonFixture({ ...lessonInput, chapterId: current.id, kind: "quiz", position: 2 }),
      lessonFixture({ ...lessonInput, chapterId: earlier.id, kind: "vocabulary", position: 0 }),
    ]);

    await Promise.all([
      prisma.courseLearningPlan.create({
        data: {
          chapterIds: [current.id, pending.id],
          contentRevision: course.contentRevision,
          courseId: course.id,
          startingLevel: "b1",
          userId: user.id,
        },
      }),
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: completed.id,
        userId: user.id,
      }),
    ]);

    const created = await apiContext.post(TRACKS_PATH, {
      data: { courseIds: [course.id], title: "German for travel" },
    });

    expect(created.status()).toBe(201);
    const track = await created.json();
    expect(trackResponseSchema.safeParse(track).success).toBe(true);

    expect(track).toMatchObject({
      courses: [
        {
          id: course.id,
          progress: {
            completedChapters: 0,
            completedLessons: 1,
            pendingChapters: 1,
            totalChapters: 2,
            totalLessons: 2,
          },
        },
      ],
      nextTarget: {
        brandSlug: organization.slug,
        chapterId: current.id,
        courseId: course.id,
        lessonId: next.id,
      },
      progress: {
        completedCourses: 0,
        completedLessons: 1,
        pendingChapters: 1,
        totalCourses: 1,
        totalLessons: 2,
      },
    });

    const pathProgress = await apiContext.get(`/v1/courses/${course.id}/progress`);
    expect(pathProgress.status()).toBe(200);

    await expect(pathProgress.json()).resolves.toMatchObject({
      chapters: [{ chapterId: current.id }, { chapterId: pending.id }],
      percentComplete: null,
    });

    const curriculumProgress = await apiContext.get(`/v1/courses/${course.id}/progress`, {
      params: { view: "curriculum" },
    });

    expect(curriculumProgress.status()).toBe(200);

    await expect(curriculumProgress.json()).resolves.toMatchObject({
      chapters: [
        { chapterId: earlier.id },
        { chapterId: current.id, totalLessons: 2 },
        { chapterId: pending.id },
      ],
      percentComplete: null,
    });

    const invalidView = await apiContext.get(`/v1/courses/${course.id}/progress`, {
      params: { view: "other" },
    });

    expect(invalidView.status()).toBe(400);

    await apiContext.dispose();
  });

  test("does not expose or mutate another learner's track", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const [owner, other] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "track-private-owner" }),
      createAuthenticatedApiContext({ baseURL, prefix: "track-private-other" }),
    ]);

    const course = await courseFixture({
      format: "personalized",
      isPublished: true,
      userId: owner.user.id,
    });

    const created = await owner.apiContext.post(TRACKS_PATH, {
      data: { courseIds: [course.id], title: "My private learning" },
    });

    expect(created.status()).toBe(201);
    const track = await created.json();

    const denied = await Promise.all([
      other.apiContext.get(`${TRACKS_PATH}/${track.id}`),
      other.apiContext.patch(`${TRACKS_PATH}/${track.id}`, { data: { title: "Changed" } }),
      other.apiContext.delete(`${TRACKS_PATH}/${track.id}`),
      other.apiContext.post(TRACKS_PATH, {
        data: { courseIds: [course.id], title: "Copied private course" },
      }),
    ]);

    for (const response of denied) {
      expect(response.status()).toBe(404);
    }

    const deniedBodies = await Promise.all(denied.map((response) => response.text()));

    for (const body of deniedBodies) {
      expect(body).not.toContain("My private learning");
    }

    const read = await owner.apiContext.get(`${TRACKS_PATH}/${track.id}`);
    expect(read.status()).toBe(200);

    await expect(read.json()).resolves.toMatchObject({
      courses: [{ brandSlug: "me", id: course.id }],
      title: "My private learning",
    });

    await Promise.all([owner.apiContext.dispose(), other.apiContext.dispose()]);
  });

  test("rejects invalid membership updates without partially changing the track", async () => {
    const [{ apiContext }, organization] = await Promise.all([
      createAuthenticatedApiContext({
        baseURL: process.env.E2E_BASE_URL ?? "",
        prefix: "track-invalid",
      }),
      organizationFixture({ kind: "brand" }),
    ]);

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const created = await apiContext.post(TRACKS_PATH, {
      data: { courseIds: [course.id], title: "Keep this track" },
    });

    expect(created.status()).toBe(201);
    const track = await created.json();
    const trackPath = `${TRACKS_PATH}/${track.id}`;

    const invalid = await Promise.all([
      apiContext.patch(trackPath, { data: {} }),
      apiContext.patch(trackPath, { data: { courseIds: [] } }),
      apiContext.patch(trackPath, { data: { courseIds: [course.id, course.id] } }),
      apiContext.patch(trackPath, { data: { title: " " } }),
      apiContext.patch(trackPath, { data: { userId: randomUUID() } }),
      apiContext.get(`${TRACKS_PATH}/invalid-id`),
      apiContext.get(TRACKS_PATH, { params: { limit: 0 } }),
      apiContext.get(TRACKS_PATH, { params: { cursor: "invalid-cursor" } }),
    ]);

    for (const response of invalid) {
      expect(response.status()).toBe(400);
    }

    const unavailable = await apiContext.patch(trackPath, {
      data: { courseIds: [course.id, randomUUID()], title: "Must not be saved" },
    });

    expect(unavailable.status()).toBe(404);

    const read = await apiContext.get(trackPath);

    await expect(read.json()).resolves.toMatchObject({
      courses: [{ id: course.id }],
      title: "Keep this track",
    });

    await apiContext.dispose();
  });

  test("removes a track while keeping courses, enrollment and completed learning", async () => {
    const [{ apiContext, user }, organization] = await Promise.all([
      createAuthenticatedApiContext({
        baseURL: process.env.E2E_BASE_URL ?? "",
        prefix: "track-remove",
      }),
      organizationFixture({ kind: "brand" }),
    ]);

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
    const chapter = await chapterFixture({ courseId: course.id, organizationId: organization.id });
    const lesson = await lessonFixture({ chapterId: chapter.id, organizationId: organization.id });

    const [, progress] = await Promise.all([
      courseUserFixture({ courseId: course.id, userId: user.id }),
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson.id,
        userId: user.id,
      }),
    ]);

    const created = await apiContext.post(TRACKS_PATH, {
      data: { courseIds: [course.id], title: "Remove grouping only" },
    });

    expect(created.status()).toBe(201);
    const track = await created.json();
    const removed = await apiContext.delete(`${TRACKS_PATH}/${track.id}`);
    expect(removed.status()).toBe(204);

    const missing = await apiContext.get(`${TRACKS_PATH}/${track.id}`);
    expect(missing.status()).toBe(404);
    await expect(prisma.course.findUnique({ where: { id: course.id } })).resolves.not.toBeNull();

    await expect(
      prisma.courseUser.findUnique({
        where: { courseUser: { courseId: course.id, userId: user.id } },
      }),
    ).resolves.not.toBeNull();

    await expect(
      prisma.lessonProgress.findUnique({ where: { id: progress.id } }),
    ).resolves.toMatchObject({ completedAt: progress.completedAt });

    await apiContext.dispose();
  });

  test("protects cookie-authenticated track mutations against cross-origin requests", async () => {
    const baseURL = process.env.E2E_BASE_URL ?? "";

    const [{ apiContext, token }, organization] = await Promise.all([
      createAuthenticatedApiContext({ baseURL, prefix: "track-origin" }),
      organizationFixture({ kind: "brand" }),
    ]);

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const created = await apiContext.post(TRACKS_PATH, {
      data: { courseIds: [course.id], title: "Protected track" },
    });

    expect(created.status()).toBe(201);
    const track = await created.json();
    const storageState = await apiContext.storageState();

    const [missingOrigin, crossOrigin, bearer] = await Promise.all([
      request.newContext({ baseURL, storageState }),
      request.newContext({
        baseURL,
        extraHTTPHeaders: { Origin: "https://attacker.example" },
        storageState,
      }),
      request.newContext({ baseURL, extraHTTPHeaders: { Authorization: `Bearer ${token}` } }),
    ]);

    const rejected = await Promise.all([
      missingOrigin.post(TRACKS_PATH, {
        data: { courseIds: [course.id], title: "Unwanted track" },
      }),
      crossOrigin.patch(`${TRACKS_PATH}/${track.id}`, { data: { title: "Changed" } }),
      crossOrigin.delete(`${TRACKS_PATH}/${track.id}`),
    ]);

    for (const response of rejected) {
      expect(response.status()).toBe(403);
    }

    const read = await bearer.get(`${TRACKS_PATH}/${track.id}`);
    expect(read.status()).toBe(200);
    await expect(read.json()).resolves.toMatchObject({ title: "Protected track" });

    const updated = await bearer.patch(`${TRACKS_PATH}/${track.id}`, {
      data: { title: "Native update" },
    });

    expect(updated.status()).toBe(200);

    await Promise.all([
      apiContext.dispose(),
      missingOrigin.dispose(),
      crossOrigin.dispose(),
      bearer.dispose(),
    ]);
  });
});
