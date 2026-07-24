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
});
