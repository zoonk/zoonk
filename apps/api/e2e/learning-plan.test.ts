import { prisma } from "@zoonk/db";
import { expect, test } from "@zoonk/e2e/fixtures";
import { getAiOrganization } from "@zoonk/e2e/fixtures/orgs";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { createAuthenticatedApiContext } from "./helpers/auth";

async function curriculumFixture() {
  const organization = await getAiOrganization();

  const course = await courseFixture({
    curriculumVersion: 2,
    isPublished: true,
    organizationId: organization.id,
  });

  const chapters = await Promise.all(
    ["overview", "basic", "intermediate", "advanced"].map((level, position) =>
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        level: level as "overview" | "basic" | "intermediate" | "advanced",
        organizationId: organization.id,
        position,
      }),
    ),
  );

  const lessons = await Promise.all(
    chapters.map((chapter) =>
      lessonFixture({ chapterId: chapter.id, isPublished: true, organizationId: organization.id }),
    ),
  );

  return { chapters, course, lessons };
}

test.describe("Course learning plans API", () => {
  test("lets guests read generated advanced material without creating a plan", async ({
    request,
  }) => {
    const { course, lessons } = await curriculumFixture();

    const [path, advanced, plan, start] = await Promise.all([
      request.get(`/v1/courses/${course.id}/learning-path`),
      request.get(`/v1/lessons/${lessons[3]!.id}`),
      request.get(`/v1/me/courses/${course.id}/learning-plan`),
      request.post(`/v1/me/courses/${course.id}/start`, { data: {} }),
    ]);

    expect(path.status()).toBe(200);
    expect(advanced.status()).toBe(200);
    expect(plan.status()).toBe(401);
    expect(start.status()).toBe(401);
    expect(await prisma.courseLearningPlan.count({ where: { courseId: course.id } })).toBe(0);
    expect(await prisma.courseUser.count({ where: { courseId: course.id } })).toBe(0);
  });

  test("honors the chosen starting level, excludes optional activities, and rejects stale edits", async () => {
    const [{ apiContext, user }, { chapters, course, lessons }] = await Promise.all([
      createAuthenticatedApiContext({
        baseURL: process.env.E2E_BASE_URL ?? "",
        prefix: "course-plan",
      }),
      curriculumFixture(),
    ]);

    const optional = await lessonFixture({
      chapterId: chapters[2]!.id,
      isPublished: true,
      kind: "quiz",
      organizationId: course.organizationId,
      position: 1,
      sourceLessonId: lessons[2]!.id,
    });

    const planPath = `/v1/me/courses/${course.id}/learning-plan`;

    const start = await apiContext.post(`/v1/me/courses/${course.id}/start`, {
      data: { expectedRevision: 0, input: { depth: "complete", startingLevel: "intermediate" } },
    });

    expect(start.status()).toBe(200);
    const started = await start.json();
    expect(started.nextTarget.lessonId).toBe(lessons[2]!.id);

    expect(started.chapters.map((chapter: { id: string }) => chapter.id)).toEqual(
      chapters.slice(2).map((chapter) => chapter.id),
    );

    expect(started.progress.totalLessons).toBe(2);
    expect(JSON.stringify(started.chapters)).not.toContain(optional.id);
    expect(started.plan).not.toHaveProperty("userId");

    const edit = await apiContext.put(planPath, {
      data: {
        expectedRevision: started.plan.revision,
        input: { depth: "overview", startingLevel: "overview" },
      },
    });

    expect(edit.status()).toBe(200);

    const stale = await apiContext.put(planPath, {
      data: {
        expectedRevision: started.plan.revision,
        input: { depth: "complete", startingLevel: "advanced" },
      },
    });

    expect(stale.status()).toBe(409);
    const path = await apiContext.get(`/v1/courses/${course.id}/learning-path`);
    const learningPath = await path.json();
    expect(learningPath.nextTarget.lessonId).toBe(lessons[0]!.id);

    expect(await prisma.courseUser.count({ where: { courseId: course.id, userId: user.id } })).toBe(
      1,
    );

    await apiContext.dispose();
  });

  test("returns an explicit update requirement for legacy curricula without replacing content", async () => {
    const [{ apiContext }, { course, chapters }] = await Promise.all([
      createAuthenticatedApiContext({
        baseURL: process.env.E2E_BASE_URL ?? "",
        prefix: "legacy-plan",
      }),
      curriculumFixture(),
    ]);

    await prisma.course.update({ data: { curriculumVersion: 1 }, where: { id: course.id } });

    const response = await apiContext.post(`/v1/me/courses/${course.id}/start`, {
      data: { input: { depth: "overview" } },
    });

    expect(response.status()).toBe(200);

    await expect(response.json()).resolves.toMatchObject({
      courseId: course.id,
      resource: "curriculum",
      resourceId: course.id,
      status: "generationRequired",
    });

    expect(
      await prisma.chapter.count({ where: { id: { in: chapters.map((chapter) => chapter.id) } } }),
    ).toBe(chapters.length);

    const stored = await prisma.course.findUniqueOrThrow({ where: { id: course.id } });
    expect(stored.generationRunId).toBeNull();
    expect(stored.curriculumVersion).toBe(1);
    await apiContext.dispose();
  });

  test("keeps private course paths and preferences available only to the owner", async ({
    request,
  }) => {
    const [owner, other] = await Promise.all([
      createAuthenticatedApiContext({
        baseURL: process.env.E2E_BASE_URL ?? "",
        prefix: "private-path-owner",
      }),
      createAuthenticatedApiContext({
        baseURL: process.env.E2E_BASE_URL ?? "",
        prefix: "private-path-other",
      }),
    ]);

    const course = await courseFixture({
      curriculumVersion: 2,
      format: "personalized",
      isPublished: true,
      userId: owner.user.id,
    });

    const chapter = await chapterFixture({ courseId: course.id, isPublished: true });
    const lesson = await lessonFixture({ chapterId: chapter.id, isPublished: true });
    const path = `/v1/courses/${course.id}/learning-path`;

    const [ownerRead, otherRead, guestRead, spoof] = await Promise.all([
      owner.apiContext.get(path),
      other.apiContext.get(path),
      request.get(path),
      other.apiContext.put(`/v1/me/courses/${course.id}/learning-plan`, {
        data: { input: { depth: "complete" } },
      }),
    ]);

    expect(ownerRead.status()).toBe(200);

    const ownerPath = await ownerRead.json();

    expect(ownerPath.nextTarget).toMatchObject({ brandSlug: "me", lessonId: lesson.id });

    expect(otherRead.status()).toBe(404);
    expect(guestRead.status()).toBe(404);
    expect(spoof.status()).toBe(404);
    await Promise.all([owner.apiContext.dispose(), other.apiContext.dispose()]);
  });
});
