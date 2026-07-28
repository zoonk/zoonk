import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { mockSession } from "../../_test-utils/mock-session";
import { getLessonContent } from "./get-playable-lesson";

vi.mock("../../users/get-session", () => ({ getSession: vi.fn() }));

/**
 * Creates a published brand curriculum with a configurable chapter position.
 */
async function createPlayableChapter(position = 0) {
  const organization = await organizationFixture({ kind: "brand" });
  const course = await courseFixture({ isPublished: true, organizationId: organization.id });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId: organization.id,
    position,
  });

  return { chapter, organization };
}

/**
 * Creates one published lesson inside a caller-owned or organization-owned
 * course so authorization tests can vary ownership without repeating the
 * curriculum hierarchy.
 */
async function createLessonForCourse({
  courseId,
  organizationId,
}: {
  courseId: string;
  organizationId: string | null;
}) {
  const chapter = await chapterFixture({
    courseId,
    isPublished: true,
    organizationId,
    position: 0,
  });

  return lessonFixture({
    chapterId: chapter.id,
    generationStatus: "completed",
    isPublished: true,
    organizationId,
  });
}

/** Authenticates one fixture learner for the next playable-lesson read. */
function authenticateUser(userId: string) {
  mockSession(userId);
}

describe(getLessonContent, () => {
  beforeEach(() => {
    mockSession(null);
  });

  it("returns unavailable for an unknown lesson", async () => {
    await expect(getLessonContent(randomUUID())).resolves.toStrictEqual({ status: "unavailable" });
  });

  it("returns a completed first-chapter lesson for a guest", async () => {
    const { chapter, organization } = await createPlayableChapter();

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      organizationId: organization.id,
    });

    const result = await getLessonContent(lesson.id);

    expect(result).toMatchObject({ lesson: { id: lesson.id }, status: "ready" });
  });

  it("requires a subscription after the first chapter", async () => {
    const [{ chapter, organization }, user] = await Promise.all([
      createPlayableChapter(1),
      userFixture(),
    ]);

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
    });

    authenticateUser(user.id);

    await expect(getLessonContent(lesson.id)).resolves.toStrictEqual({
      status: "subscriptionRequired",
    });

    await prisma.subscription.create({
      data: { plan: "plus", provider: "zoonk", referenceId: user.id, status: "active" },
    });

    await expect(getLessonContent(lesson.id)).resolves.toMatchObject({
      lesson: { id: lesson.id },
      status: "ready",
    });
  });

  it("returns a presentation-neutral not-generated outcome", async () => {
    const { chapter, organization } = await createPlayableChapter();

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      organizationId: organization.id,
    });

    await expect(getLessonContent(lesson.id)).resolves.toMatchObject({
      generationTarget: null,
      lesson: { id: lesson.id },
      status: "notGenerated",
    });
  });

  it("returns the AI generation target for a pending standalone lesson", async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      kind: "explanation",
      organizationId: organization.id,
    });

    await expect(getLessonContent(lesson.id)).resolves.toMatchObject({
      generationTarget: { kind: "lesson", lessonId: lesson.id },
      status: "notGenerated",
    });
  });

  it("returns the source lesson target for a pending generated companion", async () => {
    const organization = await aiOrganizationFixture();
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
    });

    const [sourceLesson, companionLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        isPublished: true,
        kind: "vocabulary",
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        isPublished: true,
        kind: "translation",
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await expect(getLessonContent(companionLesson.id)).resolves.toMatchObject({
      generationTarget: { kind: "sourceLesson", lessonSlug: sourceLesson.slug },
      status: "notGenerated",
    });
  });

  it("returns the earlier generation target for an empty review", async () => {
    const { chapter, organization } = await createPlayableChapter();

    const [generationLesson, reviewLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        isPublished: true,
        kind: "quiz",
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "review",
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await expect(getLessonContent(reviewLesson.id)).resolves.toMatchObject({
      generationLessonId: generationLesson.id,
      lesson: { id: reviewLesson.id },
      status: "reviewEmpty",
    });
  });

  it("does not expose published non-brand organization content by lesson ID", async () => {
    const organization = await organizationFixture({ kind: "school" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const lesson = await createLessonForCourse({
      courseId: course.id,
      organizationId: organization.id,
    });

    await expect(getLessonContent(lesson.id)).resolves.toStrictEqual({ status: "unavailable" });
  });

  it("only exposes a published personal course to its owner", async () => {
    const [owner, otherUser] = await Promise.all([userFixture(), userFixture()]);
    const course = await courseFixture({ isPublished: true, userId: owner.id });
    const lesson = await createLessonForCourse({ courseId: course.id, organizationId: null });

    authenticateUser(otherUser.id);
    await expect(getLessonContent(lesson.id)).resolves.toStrictEqual({ status: "unavailable" });

    authenticateUser(owner.id);

    await expect(getLessonContent(lesson.id)).resolves.toMatchObject({
      lesson: { id: lesson.id },
      status: "ready",
    });
  });
});
