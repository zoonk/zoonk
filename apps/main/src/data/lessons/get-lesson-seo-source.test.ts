import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { organizationFixture } from "@zoonk/testing/fixtures/orgs";
import { describe, expect, it } from "vitest";
import { getLessonSeoSource } from "./get-lesson-seo-source";

describe(getLessonSeoSource, () => {
  it("finds the nearest authored topic for generated companion metadata", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
    });

    const [firstExplanation, secondExplanation, quiz, practice, vocabulary, translation] =
      await Promise.all([
        lessonFixture({
          chapterId: chapter.id,
          isPublished: true,
          kind: "explanation",
          organizationId: organization.id,
          position: 0,
          title: "First topic",
        }),
        lessonFixture({
          chapterId: chapter.id,
          isPublished: true,
          kind: "explanation",
          organizationId: organization.id,
          position: 3,
          title: "Second topic",
        }),
        lessonFixture({
          chapterId: chapter.id,
          isPublished: true,
          kind: "quiz",
          organizationId: organization.id,
          position: 4,
          title: null,
        }),
        lessonFixture({
          chapterId: chapter.id,
          isPublished: true,
          kind: "practice",
          organizationId: organization.id,
          position: 5,
          title: null,
        }),
        lessonFixture({
          chapterId: chapter.id,
          isPublished: true,
          kind: "vocabulary",
          organizationId: organization.id,
          position: 6,
          title: "Vocabulary topic",
        }),
        lessonFixture({
          chapterId: chapter.id,
          isPublished: true,
          kind: "translation",
          organizationId: organization.id,
          position: 7,
          title: null,
        }),
      ]);

    await expect(getLessonSeoSource(quiz)).resolves.toMatchObject({ id: secondExplanation.id });
    await expect(getLessonSeoSource(practice)).resolves.toMatchObject({ id: secondExplanation.id });
    await expect(getLessonSeoSource(translation)).resolves.toMatchObject({ id: vocabulary.id });
    await expect(getLessonSeoSource(firstExplanation)).resolves.toBeNull();
  });

  it("locates a translation by ID after an earlier vocabulary split shifts positions", async () => {
    const organization = await organizationFixture({ kind: "brand" });
    const course = await courseFixture({ isPublished: true, organizationId: organization.id });

    const chapter = await chapterFixture({
      courseId: course.id,
      isPublished: true,
      organizationId: organization.id,
    });

    const [firstVocabulary, , secondVocabulary, secondTranslation] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "vocabulary",
        organizationId: organization.id,
        position: 0,
        title: "First vocabulary",
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "translation",
        organizationId: organization.id,
        position: 1,
        title: null,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "vocabulary",
        organizationId: organization.id,
        position: 2,
        title: "Second vocabulary",
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "translation",
        organizationId: organization.id,
        position: 3,
        title: null,
      }),
    ]);

    await prisma.lesson.updateMany({
      data: { position: { increment: 2 } },
      where: { chapterId: chapter.id, position: { gt: 1 } },
    });

    await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "vocabulary",
        organizationId: organization.id,
        position: 2,
        title: null,
      }),
      lessonFixture({
        chapterId: chapter.id,
        isPublished: true,
        kind: "translation",
        organizationId: organization.id,
        position: 3,
        title: null,
      }),
    ]);

    const sourceLesson = await getLessonSeoSource(secondTranslation);

    expect(sourceLesson).toMatchObject({ id: secondVocabulary.id });
    expect(sourceLesson).not.toMatchObject({ id: firstVocabulary.id });
  });
});
