import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { chapterFixture } from "@zoonk/testing/fixtures/chapters";
import { courseFixture } from "@zoonk/testing/fixtures/courses";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, describe, expect, it } from "vitest";
import { isStandaloneGeneratedLessonKind } from "./generated-companion-kinds";
import {
  getGeneratedCompanionForSourceLesson,
  getSourceLessonForGeneratedCompanion,
} from "./generated-companions";

async function createChapter({ organizationId }: { organizationId: string }) {
  const course = await courseFixture({
    isPublished: true,
    organizationId,
    targetLanguage: "es",
    title: `Companion Course ${randomUUID()}`,
  });

  return chapterFixture({
    courseId: course.id,
    isPublished: true,
    organizationId,
    title: `Companion Chapter ${randomUUID()}`,
  });
}

describe("generated companions", () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("identifies standalone lesson generation targets", () => {
    expect(isStandaloneGeneratedLessonKind("vocabulary")).toBe(true);
    expect(isStandaloneGeneratedLessonKind("reading")).toBe(true);
    expect(isStandaloneGeneratedLessonKind("translation")).toBe(false);
    expect(isStandaloneGeneratedLessonKind("listening")).toBe(false);
    expect(isStandaloneGeneratedLessonKind("review")).toBe(false);
    expect(isStandaloneGeneratedLessonKind("custom")).toBe(false);
  });

  it("finds the source lesson for generated companion rows", async () => {
    const chapter = await createChapter({ organizationId });

    const [vocabulary, translation] = await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        isPublished: true,
        kind: "vocabulary",
        organizationId,
        position: 0,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "pending",
        isPublished: true,
        kind: "translation",
        organizationId,
        position: 1,
      }),
    ]);

    await expect(
      getSourceLessonForGeneratedCompanion({ chapterId: chapter.id, lessonId: translation.id }),
    ).resolves.toMatchObject({ id: vocabulary.id, kind: "vocabulary" });
  });

  it("finds the companion lesson before the next source row", async () => {
    const chapter = await createChapter({ organizationId });

    const [firstVocabulary, firstTranslation, secondVocabulary, secondTranslation] =
      await Promise.all([
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "pending",
          isPublished: true,
          kind: "vocabulary",
          organizationId,
          position: 0,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "pending",
          isPublished: true,
          kind: "translation",
          organizationId,
          position: 1,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "pending",
          isPublished: true,
          kind: "vocabulary",
          organizationId,
          position: 2,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "pending",
          isPublished: true,
          kind: "translation",
          organizationId,
          position: 3,
        }),
      ]);

    await expect(
      getGeneratedCompanionForSourceLesson({ chapterId: chapter.id, lessonId: firstVocabulary.id }),
    ).resolves.toMatchObject({ id: firstTranslation.id });

    await expect(
      getGeneratedCompanionForSourceLesson({
        chapterId: chapter.id,
        lessonId: secondVocabulary.id,
      }),
    ).resolves.toMatchObject({ id: secondTranslation.id });
  });

  it("reloads the current lesson positions after an earlier pair is inserted", async () => {
    const chapter = await createChapter({ organizationId });

    const [firstVocabulary, firstTranslation, secondVocabulary, secondTranslation] =
      await Promise.all([
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          kind: "vocabulary",
          organizationId,
          position: 0,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          kind: "translation",
          organizationId,
          position: 1,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "completed",
          isPublished: true,
          kind: "vocabulary",
          organizationId,
          position: 2,
        }),
        lessonFixture({
          chapterId: chapter.id,
          generationStatus: "pending",
          isPublished: true,
          kind: "translation",
          organizationId,
          position: 3,
        }),
      ]);

    await prisma.lesson.updateMany({
      data: { position: { increment: 2 } },
      where: { chapterId: chapter.id, position: { gte: secondVocabulary.position } },
    });

    await Promise.all([
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        organizationId,
        position: 2,
      }),
      lessonFixture({
        chapterId: chapter.id,
        generationStatus: "completed",
        isPublished: true,
        kind: "translation",
        organizationId,
        position: 3,
      }),
    ]);

    await expect(
      getSourceLessonForGeneratedCompanion({
        chapterId: chapter.id,
        lessonId: secondTranslation.id,
      }),
    ).resolves.toMatchObject({ id: secondVocabulary.id });

    await expect(
      getGeneratedCompanionForSourceLesson({
        chapterId: chapter.id,
        lessonId: secondVocabulary.id,
      }),
    ).resolves.toMatchObject({ generationStatus: "pending", id: secondTranslation.id });

    await expect(
      getGeneratedCompanionForSourceLesson({ chapterId: chapter.id, lessonId: firstVocabulary.id }),
    ).resolves.toMatchObject({ id: firstTranslation.id });
  });
});
