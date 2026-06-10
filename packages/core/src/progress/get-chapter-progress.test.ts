import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it } from "vitest";
import { getChapterProgress } from "./get-chapter-progress";

describe(getChapterProgress, () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  it("returns empty array when unauthenticated", async () => {
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });
    const result = await getChapterProgress({ courseId: course.id, headers: new Headers() });
    expect(result).toStrictEqual([]);
  });

  it("returns chapters with zero counts when user has no progress", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getChapterProgress({ courseId: course.id, headers });
    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 0, totalLessons: 1 }]);
  });

  it("counts completed lessons directly", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson1.id,
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getChapterProgress({ courseId: course.id, headers });
    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 1, totalLessons: 2 }]);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson2.id,
      userId: user.id,
    });

    const result2 = await getChapterProgress({ courseId: course.id, headers });

    expect(result2).toStrictEqual([
      { chapterId: chapter.id, completedLessons: 2, totalLessons: 2 },
    ]);
  });

  it("returns correct counts across multiple chapters", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const [chapter1, chapter2] = await Promise.all([
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const [lesson1, _lesson2] = await Promise.all([
      lessonFixture({
        chapterId: chapter1.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter2.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    // Complete only the first chapter's lesson
    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson1.id,
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getChapterProgress({ courseId: course.id, headers });

    expect(result).toStrictEqual([
      { chapterId: chapter1.id, completedLessons: 1, totalLessons: 1 },
      { chapterId: chapter2.id, completedLessons: 0, totalLessons: 1 },
    ]);
  });

  it("excludes started-but-not-completed lessons from lesson completion", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const lesson = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    // Started but not completed
    await lessonProgressFixture({
      completedAt: null,
      durationSeconds: 30,
      lessonId: lesson.id,
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getChapterProgress({ courseId: course.id, headers });
    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 0, totalLessons: 1 }]);
  });

  it("only counts published lessons", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [publishedLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: false,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: publishedLesson.id,
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getChapterProgress({ courseId: course.id, headers });
    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 1, totalLessons: 1 }]);
  });

  it("excludes hidden lesson kinds from chapter totals", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [visibleLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "explanation",
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "quiz",
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    const [headers] = await Promise.all([
      signInAs(user.email, user.password),
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: visibleLesson.id,
        userId: user.id,
      }),
    ]);

    const result = await getChapterProgress({
      courseId: course.id,
      excludedLessonKinds: ["quiz"],
      headers,
    });

    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 1, totalLessons: 1 }]);
  });

  it("chapters with 0 published lessons return totalLessons 0", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    // Chapter with no lessons at all
    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getChapterProgress({ courseId: course.id, headers });
    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 0, totalLessons: 0 }]);
  });

  it("incomplete lessons still count toward the chapter total", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getChapterProgress({ courseId: course.id, headers });
    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 0, totalLessons: 1 }]);
  });

  it("a chapter stays in progress while another published lesson is incomplete", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [completedLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: completedLesson.id,
      userId: user.id,
    });

    const headers = await signInAs(user.email, user.password);
    const result = await getChapterProgress({ courseId: course.id, headers });

    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 1, totalLessons: 2 }]);
  });

  it("keeps a durably completed chapter completed when a new lesson is added later", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
    ]);

    await prisma.chapterCompletion.create({ data: { chapterId: chapter.id, userId: user.id } });

    const headers = await signInAs(user.email, user.password);
    const result = await getChapterProgress({ courseId: course.id, headers });

    expect(result).toStrictEqual([{ chapterId: chapter.id, completedLessons: 2, totalLessons: 2 }]);
  });
});
