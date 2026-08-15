import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { getLessonGenerationView } from "./lesson-generation-view";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe(getLessonGenerationView, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(async () => {
    const user = await userFixture();
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });
  });

  it("requires authentication before showing a pending generation", async () => {
    const course = await courseFixture({
      organizationId,
      title: `Authentication generation view ${randomUUID()}`,
    });

    const chapter = await chapterFixture({ courseId: course.id, organizationId, position: 0 });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      kind: "explanation",
      organizationId,
    });

    vi.mocked(getSession).mockResolvedValue(null);

    await expect(getLessonGenerationView(lesson.id)).resolves.toStrictEqual({
      status: "unauthorized",
    });
  });

  it("lets guests continue from a completed lesson to its public page", async () => {
    const course = await courseFixture({
      generationStatus: "completed",
      isPublished: true,
      organizationId,
      title: `Generation view ${randomUUID()}`,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId,
      position: 0,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      organizationId,
    });

    vi.mocked(getSession).mockResolvedValue(null);

    await expect(getLessonGenerationView(lesson.id)).resolves.toMatchObject({
      isReadyForRedirect: true,
      lesson: { id: lesson.id, kind: "explanation" },
      status: "ready",
    });

    expect(getSession).toHaveBeenCalledWith();
  });

  it.each([
    { chapterIsPublished: true, courseIsPublished: true, lessonIsPublished: false },
    { chapterIsPublished: false, courseIsPublished: true, lessonIsPublished: true },
    { chapterIsPublished: true, courseIsPublished: false, lessonIsPublished: true },
  ])(
    "requires authentication when a completed lesson is outside the public hierarchy",
    async ({ chapterIsPublished, courseIsPublished, lessonIsPublished }) => {
      const course = await courseFixture({
        generationStatus: "completed",
        isPublished: courseIsPublished,
        organizationId,
        title: `Private generation view ${randomUUID()}`,
      });

      const chapter = await chapterFixture({
        courseId: course.id,
        isPublished: chapterIsPublished,
        organizationId,
        position: 0,
      });

      const lesson = await lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: lessonIsPublished,
        kind: "explanation",
        organizationId,
      });

      vi.mocked(getSession).mockResolvedValue(null);

      await expect(getLessonGenerationView(lesson.id)).resolves.toStrictEqual({
        status: "unauthorized",
      });
    },
  );

  it("routes an incomplete generated companion through its source lesson", async () => {
    const course = await courseFixture({
      organizationId,
      title: `Companion generation view ${randomUUID()}`,
    });

    const chapter = await chapterFixture({ courseId: course.id, organizationId, position: 0 });

    const [sourceLesson, companionLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "vocabulary",
        organizationId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "translation",
        organizationId,
        position: 1,
      }),
    ]);

    await expect(getLessonGenerationView(companionLesson.id)).resolves.toMatchObject({
      lesson: { id: companionLesson.id },
      sourceLessonId: sourceLesson.id,
      status: "redirectToSource",
    });
  });

  it("waits for an incomplete companion before redirecting a completed source lesson", async () => {
    const course = await courseFixture({
      organizationId,
      title: `Incomplete companion view ${randomUUID()}`,
    });

    const chapter = await chapterFixture({ courseId: course.id, organizationId, position: 0 });

    const [sourceLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        kind: "reading",
        organizationId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "failed",
        kind: "listening",
        organizationId,
        position: 1,
      }),
    ]);

    await expect(getLessonGenerationView(sourceLesson.id)).resolves.toMatchObject({
      isReadyForRedirect: false,
      lesson: { id: sourceLesson.id },
      status: "ready",
    });
  });

  it("preserves the existing redirect behavior while a companion is running", async () => {
    const course = await courseFixture({
      organizationId,
      title: `Running companion view ${randomUUID()}`,
    });

    const chapter = await chapterFixture({ courseId: course.id, organizationId, position: 0 });

    const [sourceLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        kind: "vocabulary",
        organizationId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "running",
        kind: "translation",
        organizationId,
        position: 1,
      }),
    ]);

    await expect(getLessonGenerationView(sourceLesson.id)).resolves.toMatchObject({
      isReadyForRedirect: true,
      lesson: { id: sourceLesson.id },
      status: "ready",
    });
  });

  it("returns the lesson when a subscription gate must be shown", async () => {
    const course = await courseFixture({
      organizationId,
      title: `Subscription generation view ${randomUUID()}`,
    });

    const chapter = await chapterFixture({ courseId: course.id, organizationId, position: 1 });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "explanation",
      organizationId,
    });

    await expect(getLessonGenerationView(lesson.id)).resolves.toMatchObject({
      lesson: { id: lesson.id },
      status: "subscriptionRequired",
    });
  });

  it("checks subscription before routing a companion through its source", async () => {
    const course = await courseFixture({
      organizationId,
      title: `Gated companion view ${randomUUID()}`,
    });

    const chapter = await chapterFixture({ courseId: course.id, organizationId, position: 1 });

    const [, companionLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "vocabulary",
        organizationId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        kind: "translation",
        organizationId,
        position: 1,
      }),
    ]);

    await expect(getLessonGenerationView(companionLesson.id)).resolves.toMatchObject({
      lesson: { id: companionLesson.id },
      status: "subscriptionRequired",
    });
  });

  it("allows a trialing learner to generate a later lesson", async () => {
    const [course, user] = await Promise.all([
      courseFixture({ organizationId, title: `Trialing generation view ${randomUUID()}` }),
      userFixture(),
    ]);

    const chapter = await chapterFixture({ courseId: course.id, organizationId, position: 1 });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      kind: "explanation",
      organizationId,
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "trialing" },
    });

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    await expect(getLessonGenerationView(lesson.id)).resolves.toMatchObject({
      lesson: { id: lesson.id },
      status: "ready",
    });
  });

  it("hides lesson kinds without a generation workflow before asking guests to log in", async () => {
    const course = await courseFixture({
      organizationId,
      title: `Unsupported generation view ${randomUUID()}`,
    });

    const chapter = await chapterFixture({ courseId: course.id, organizationId, position: 0 });

    const lesson = await lessonFixture({ chapterId: chapter.id, kind: "custom", organizationId });

    vi.mocked(getSession).mockResolvedValue(null);

    await expect(getLessonGenerationView(lesson.id)).resolves.toStrictEqual({ status: "notFound" });
  });
});
