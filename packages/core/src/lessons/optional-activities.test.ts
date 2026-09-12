import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { getSession } from "../users/get-session";
import { listChapterLessons } from "./list-chapter-lessons";
import {
  getLessonOptionalActivities,
  listChapterOptionalActivities,
  startLessonOptionalActivity,
} from "./optional-activities";

vi.mock("../users/get-session", () => ({ getSession: vi.fn() }));

describe("optional-activities.test", () => {
  beforeEach(() => vi.mocked(getSession).mockResolvedValue(null));

  it("keeps chapter-scoped language reviews available without adding them to required progress", async () => {
    const organization = await organizationFixture({ kind: "brand" });

    const course = await courseFixture({
      format: "language",
      isPublished: true,
      organizationId: organization.id,
      targetLanguage: "de",
    });

    const chapter = await chapterFixture({ courseId: course.id, isPublished: true });

    const teaching = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      kind: "vocabulary",
      position: 0,
    });

    const review = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      kind: "review",
      position: 1,
    });

    await expect(
      listChapterLessons({ chapterId: chapter.id, view: "teaching" }),
    ).resolves.toMatchObject([{ id: teaching.id }]);

    await expect(listChapterOptionalActivities({ chapterId: chapter.id })).resolves.toMatchObject({
      courseId: course.id,
      groups: [],
      reviews: [{ id: review.id }],
      status: "ready",
    });

    await expect(prisma.lesson.count({ where: { chapterId: chapter.id } })).resolves.toBe(2);
  });

  it("lets guests discover available optional content and serializes explicit creation", async () => {
    const organization = await organizationFixture();
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
    const chapter = await chapterFixture({ courseId: course.id, isPublished: true });

    const source = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
    });

    await expect(getLessonOptionalActivities({ lessonId: source.id })).resolves.toMatchObject({
      activities: [
        { kind: "quiz", lesson: null },
        { kind: "practice", lesson: null },
      ],
      status: "ready",
    });

    await expect(
      startLessonOptionalActivity({ kind: "quiz", lessonId: source.id }),
    ).resolves.toStrictEqual({ status: "unauthorized" });

    const user = await userFixture();
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user });

    const results = await Promise.all([
      startLessonOptionalActivity({ kind: "quiz", lessonId: source.id }),
      startLessonOptionalActivity({ kind: "quiz", lessonId: source.id }),
    ]);

    expect(results[0]).toStrictEqual(results[1]);

    expect(results[0]).toMatchObject({
      lesson: { kind: "quiz", sourceLessonId: source.id },
      resource: "lesson",
      status: "generationRequired",
    });

    await expect(
      prisma.lesson.count({ where: { kind: "quiz", sourceLessonId: source.id } }),
    ).resolves.toBe(1);
  });

  it("does not expose another learner's private activities", async () => {
    const [owner, viewer] = await Promise.all([userFixture(), userFixture()]);

    const course = await courseFixture({
      format: "personalized",
      isPublished: true,
      userId: owner.id,
    });

    const chapter = await chapterFixture({ courseId: course.id, isPublished: true });
    const source = await lessonFixture({ chapterId: chapter.id, isPublished: true });
    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user: viewer });

    await expect(getLessonOptionalActivities({ lessonId: source.id })).resolves.toStrictEqual({
      status: "notFound",
    });

    await expect(
      startLessonOptionalActivity({ kind: "practice", lessonId: source.id }),
    ).resolves.toStrictEqual({ status: "notFound" });
  });

  it("keeps hidden teaching available in the full curriculum and groups optional activities without creating them", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const owner = await userFixture();

    const course = await courseFixture({
      format: "core",
      isPublished: true,
      organizationId: organization.id,
    });

    const chapter = await chapterFixture({ courseId: course.id, isPublished: true });

    const source = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "explanation",
      position: 0,
    });

    const tutorial = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "completed",
      isPublished: true,
      kind: "tutorial",
      position: 1,
    });

    const quiz = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      kind: "quiz",
      position: 2,
      sourceLessonId: source.id,
    });

    await prisma.courseLearningPlan.create({
      data: {
        chapterIds: [chapter.id],
        contentRevision: course.contentRevision,
        courseId: course.id,
        depth: "complete",
        hiddenLessonKinds: ["tutorial"],
        userId: owner.id,
      },
    });

    vi.mocked(getSession, { partial: true }).mockResolvedValue({ user: owner });

    const teaching = await listChapterLessons({ chapterId: chapter.id, view: "teaching" });
    const curriculum = await listChapterLessons({ chapterId: chapter.id, view: "curriculum" });
    expect(teaching.map((lesson) => lesson.id)).toStrictEqual([source.id]);
    expect(curriculum.map((lesson) => lesson.id)).toStrictEqual([source.id, tutorial.id]);

    await expect(listChapterOptionalActivities({ chapterId: chapter.id })).resolves.toMatchObject({
      groups: [
        {
          activities: [
            { kind: "quiz", lesson: { id: quiz.id } },
            { kind: "practice", lesson: null },
          ],
          source: { lessonId: source.id },
        },
      ],
      status: "ready",
    });

    const all = await listChapterOptionalActivities({ chapterId: chapter.id, view: "curriculum" });

    expect(
      all.status === "ready" && all.groups.map((group) => group.source.lessonId),
    ).toStrictEqual([source.id, tutorial.id]);

    await expect(prisma.lesson.count({ where: { chapterId: chapter.id } })).resolves.toBe(3);
  });
});
