import { prisma } from "@zoonk/db";
import { signInAs } from "@zoonk/testing/fixtures/auth";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture, lessonProgressFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { userFixture } from "@zoonk/testing/fixtures/users";
import { beforeAll, describe, expect, it } from "vitest";
import { MAX_CONTINUE_LEARNING_ITEMS, getContinueLearning } from "./get-continue-learning";

async function createCourseWithLessons(organizationId: string) {
  const course = await courseFixture({ isPublished: true, organizationId });

  const chapter = await chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId,
    position: 0,
  });

  const [lesson1, lesson2] = await Promise.all([
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

  return { chapter, course, lesson1, lesson2 };
}

describe("unauthenticated users", () => {
  it("returns empty array", async () => {
    const result = await getContinueLearning(new Headers());
    expect(result).toStrictEqual([]);
  });
});

describe("authenticated users", () => {
  let organization: Awaited<ReturnType<typeof organizationFixture>>;

  beforeAll(async () => {
    organization = await organizationFixture();
  });

  it("returns empty array when user has no completions", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const result = await getContinueLearning(headers);
    expect(result).toStrictEqual([]);
  });

  it("ignores courses where the user started but did not complete a lesson", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const { course, lesson1 } = await createCourseWithLessons(organization.id);

    await Promise.all([
      prisma.courseUser.create({ data: { courseId: course.id, userId: user.id } }),
      lessonProgressFixture({
        completedAt: null,
        durationSeconds: null,
        lessonId: lesson1.id,
        userId: user.id,
      }),
    ]);

    const result = await getContinueLearning(headers);

    expect(result).toStrictEqual([]);
  });

  it("returns courses with next lesson info based on completions", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const { lesson1, lesson2, chapter, course } = await createCourseWithLessons(organization.id);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson1.id,
      userId: user.id,
    });

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      chapter: { id: chapter.id, title: chapter.title },
      course: { id: course.id },
      lesson: { id: lesson2.id },
      status: "completed",
    });
  });

  it("uses visible lesson kinds when choosing the next home continue target", async () => {
    const [user, course] = await Promise.all([
      userFixture(),
      courseFixture({ isPublished: true, organizationId: organization.id }),
    ]);

    const [headers, chapter] = await Promise.all([
      signInAs(user.email, user.password),
      chapterFixture({
        courseId: course.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    const [completedLesson, hiddenLesson, nextVisibleLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "quiz",
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "explanation",
        organizationId: organization.id,
        position: 2,
      }),
    ]);

    await Promise.all([
      prisma.userLearningProfile.create({
        data: { preferences: { hiddenLessonKinds: ["quiz"] }, userId: user.id },
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: completedLesson.id,
        userId: user.id,
      }),
    ]);

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      chapter: { id: chapter.id, title: chapter.title },
      course: { id: course.id },
      lesson: { id: nextVisibleLesson.id },
      status: "completed",
    });

    expect(result[0]).not.toMatchObject({ lesson: { id: hiddenLesson.id } });
  });

  it("does not reopen a durably completed lesson after new lessons are added", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);
    const userId = user.id;

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [completedLesson, replacementSecondLesson, nextLesson] = await Promise.all([
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
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 2,
      }),
    ]);

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: completedLesson.id,
        userId,
      }),
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: replacementSecondLesson.id,
        userId,
      }),
    ]);

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      chapter: { id: chapter.id, title: chapter.title },
      course: { id: course.id },
      lesson: { id: nextLesson.id },
      status: "completed",
    });

    expect(result[0]).not.toMatchObject({ lesson: { id: replacementSecondLesson.id } });

    expect(completedLesson.id).not.toBe(nextLesson.id);
  });

  it("orders by most recent completion", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const data1 = await createCourseWithLessons(organization.id);
    const data2 = await createCourseWithLessons(organization.id);

    const now = new Date();

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date(now.getTime() - 1000),
        durationSeconds: 60,
        lessonId: data1.lesson1.id,
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: now,
        durationSeconds: 60,
        lessonId: data2.lesson1.id,
        userId: user.id,
      }),
    ]);

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({ course: { id: data2.course.id }, status: "completed" });
    expect(result[1]).toMatchObject({ course: { id: data1.course.id }, status: "completed" });
  });

  it("limits to max items", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const courses = await Promise.all(
      Array.from({ length: MAX_CONTINUE_LEARNING_ITEMS + 1 }, () =>
        createCourseWithLessons(organization.id),
      ),
    );

    const now = new Date();

    await Promise.all(
      courses.map((data, idx) =>
        lessonProgressFixture({
          completedAt: new Date(now.getTime() + idx * 1000),
          durationSeconds: 60,
          lessonId: data.lesson1.id,
          userId: user.id,
        }),
      ),
    );

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(MAX_CONTINUE_LEARNING_ITEMS);
  });

  it("filters out completed courses", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const { lesson1, lesson2 } = await createCourseWithLessons(organization.id);

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date("2024-01-01"),
        durationSeconds: 60,
        lessonId: lesson1.id,
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: new Date("2024-01-02"),
        durationSeconds: 60,
        lessonId: lesson2.id,
        userId: user.id,
      }),
    ]);

    const result = await getContinueLearning(headers);

    expect(result).toStrictEqual([]);
  });

  it("filters out durably completed courses even when a new chapter is added later", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const [completedChapter, addedChapter] = await Promise.all([
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

    const [completedLesson] = await Promise.all([
      lessonFixture({
        chapterId: completedChapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: addedChapter.id,
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: completedLesson.id,
        userId: user.id,
      }),
      prisma.courseCompletion.create({ data: { courseId: course.id, userId: user.id } }),
    ]);

    const result = await getContinueLearning(headers);

    expect(result).toStrictEqual([]);
  });

  it("finds lesson in next chapter when current chapter is complete", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

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

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId: chapter1.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter2.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
    ]);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson1.id,
      userId: user.id,
    });

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      chapter: { id: chapter2.id, title: chapter2.title },
      lesson: { id: lesson2.id },
      status: "completed",
    });
  });

  it("excludes courses from non-brand organizations", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const schoolOrg = await organizationFixture({ kind: "school" });
    const { lesson1, lesson2 } = await createCourseWithLessons(schoolOrg.id);

    await Promise.all([
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson1.id,
        userId: user.id,
      }),
      lessonProgressFixture({
        completedAt: new Date(),
        durationSeconds: 60,
        lessonId: lesson2.id,
        userId: user.id,
      }),
    ]);

    const result = await getContinueLearning(headers);

    expect(result).toStrictEqual([]);
  });

  it("returns null organization for personal courses", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const course = await courseFixture({
      format: "question",
      isPublished: true,
      organizationId: null,
      userId: user.id,
    });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: null,
      position: 0,
    });

    const [lesson1, lesson2] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: null,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: null,
        position: 1,
      }),
    ]);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson1.id,
      userId: user.id,
    });

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      course: { id: course.id, organization: null },
      lesson: { id: lesson2.id },
      status: "completed",
    });
  });

  it("returns pending item when next lesson has no generated lessons", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const lesson1 = await lessonFixture({
      chapterId: chapter.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const lesson2 = await lessonFixture({
      chapterId: chapter.id,
      generationStatus: "pending",
      isPublished: true,
      organizationId: organization.id,
      position: 1,
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson1.id,
      userId: user.id,
    });

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      chapter: { id: chapter.id, slug: chapter.slug, title: chapter.title },
      course: { id: course.id },
      lesson: { id: lesson2.id, slug: lesson2.slug, title: lesson2.title },
      status: "pending",
    });
  });

  it("returns the pending tree-next lesson before a later generated lesson", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [completedLesson, pendingLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "practice",
        organizationId: organization.id,
        position: 2,
      }),
    ]);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: completedLesson.id,
      userId: user.id,
    });

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      chapter: { id: chapter.id, slug: chapter.slug, title: chapter.title },
      course: { id: course.id },
      lesson: { id: pendingLesson.id, slug: pendingLesson.slug, title: pendingLesson.title },
      status: "pending",
    });
  });

  it("returns the next pending lesson target after the completed lesson", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const [, completedLesson, nextLesson] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        organizationId: organization.id,
        position: 1,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        isPublished: true,
        organizationId: organization.id,
        position: 2,
      }),
    ]);

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: completedLesson.id,
      userId: user.id,
    });

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      chapter: { id: chapter.id, slug: chapter.slug, title: chapter.title },
      course: { id: course.id },
      lesson: { id: nextLesson.id, slug: nextLesson.slug, title: nextLesson.title },
      status: "pending",
    });
  });

  it("returns pending item linking to chapter when no next published lesson", async () => {
    const user = await userFixture();
    const headers = await signInAs(user.email, user.password);

    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter1 = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    const chapter2 = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
      position: 1,
    });

    const lesson = await lessonFixture({
      chapterId: chapter1.id,
      generationStatus: "completed",
      isPublished: true,
      organizationId: organization.id,
      position: 0,
    });

    await lessonProgressFixture({
      completedAt: new Date(),
      durationSeconds: 60,
      lessonId: lesson.id,
      userId: user.id,
    });

    const result = await getContinueLearning(headers);

    expect(result).toHaveLength(1);

    expect(result[0]).toMatchObject({
      chapter: { id: chapter2.id, slug: chapter2.slug, title: chapter2.title },
      course: { id: course.id },
      lesson: null,
      status: "pending",
    });
  });
});
