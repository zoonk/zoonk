import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture, organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { startCurrentUserTrack } from "./tracks";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

async function scenario(format: "core" | "language" | "question" = "core") {
  const [user, organization] = await Promise.all([userFixture(), aiOrganizationFixture()]);
  vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

  const course = await courseFixture({
    curriculumVersion: 2,
    format,
    isPublished: true,
    organizationId: organization.id,
  });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    level: { core: "overview", language: "a1", question: null }[format] as "overview" | "a1" | null,
    organizationId: organization.id,
  });

  const lesson = await lessonFixture({
    chapterId: chapter.id,
    isPublished: true,
    kind: format === "language" ? "vocabulary" : "explanation",
    organizationId: organization.id,
  });

  const track = await prisma.track.create({
    data: {
      courses: { create: { courseId: course.id, position: 0 } },
      title: "My learning",
      userId: user.id,
    },
  });

  return { chapter, course, lesson, organization, track, user };
}

describe("Track course setup", () => {
  beforeEach(() => vi.mocked(getSession).mockResolvedValue(null));

  it.each(["core", "language"] as const)(
    "requires a first learning choice for a new %s member without creating a plan or generating",
    async (format) => {
      const { course, organization, track, user } = await scenario(format);

      await expect(startCurrentUserTrack({ trackId: track.id })).resolves.toStrictEqual({
        brandSlug: organization.slug,
        courseId: course.id,
        courseSlug: course.slug,
        status: "needsPlan",
      });

      await expect(prisma.courseLearningPlan.count({ where: { userId: user.id } })).resolves.toBe(
        0,
      );

      await expect(prisma.courseUser.count({ where: { userId: user.id } })).resolves.toBe(0);

      await expect(
        prisma.generationQuotaClaim.count({ where: { actorKey: `user:${user.id}` } }),
      ).resolves.toBe(0);
    },
  );

  it("continues an existing selected path instead of asking for setup again", async () => {
    const { chapter, course, lesson, track, user } = await scenario();

    await prisma.courseLearningPlan.create({
      data: {
        chapterIds: [chapter.id],
        contentRevision: course.contentRevision,
        courseId: course.id,
        depth: "overview",
        userId: user.id,
      },
    });

    await expect(startCurrentUserTrack({ trackId: track.id })).resolves.toMatchObject({
      nextTarget: { lessonId: lesson.id },
      status: "ready",
    });
  });

  it("opens the focused question experience without comprehensive-course setup", async () => {
    const { lesson, track } = await scenario("question");

    await expect(startCurrentUserTrack({ trackId: track.id })).resolves.toMatchObject({
      nextTarget: { lessonId: lesson.id },
      status: "ready",
    });
  });

  it("counts completed legacy learning without requiring a new curriculum", async () => {
    const { course, lesson, track, user } = await scenario();

    await prisma.course.update({ data: { curriculumVersion: 1 }, where: { id: course.id } });

    await prisma.chapter.updateMany({ data: { level: null }, where: { courseId: course.id } });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: user.id,
    });

    await expect(startCurrentUserTrack({ trackId: track.id })).resolves.toMatchObject({
      status: "completed",
      track: { progress: { completedCourses: 1, totalCourses: 1 } },
    });

    await expect(
      prisma.generationQuotaClaim.count({ where: { actorKey: `user:${user.id}` } }),
    ).resolves.toBe(0);
  });

  it("keeps an unprepared authored course incomplete without offering unsupported generation", async () => {
    const { course, lesson, track, user } = await scenario();
    const organization = await organizationFixture({ kind: "brand" });

    await prisma.course.update({
      data: { curriculumVersion: 1, organizationId: organization.id },
      where: { id: course.id },
    });

    await prisma.chapter.updateMany({ data: { level: null }, where: { courseId: course.id } });
    await prisma.lesson.update({ data: { generationStatus: "pending" }, where: { id: lesson.id } });

    await expect(startCurrentUserTrack({ trackId: track.id })).resolves.toStrictEqual({
      status: "unavailable",
    });

    await prisma.lesson.update({
      data: { generationStatus: "completed" },
      where: { id: lesson.id },
    });

    await expect(startCurrentUserTrack({ trackId: track.id })).resolves.toMatchObject({
      nextTarget: { lessonId: lesson.id },
      status: "ready",
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: user.id,
    });

    await expect(startCurrentUserTrack({ trackId: track.id })).resolves.toMatchObject({
      status: "completed",
      track: { progress: { completedCourses: 1, totalCourses: 1 } },
    });
  });
});
