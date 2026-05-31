import { randomUUID } from "node:crypto";
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

    await expect(getSourceLessonForGeneratedCompanion(translation)).resolves.toMatchObject({
      id: vocabulary.id,
      kind: "vocabulary",
    });
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

    await expect(getGeneratedCompanionForSourceLesson(firstVocabulary)).resolves.toMatchObject({
      id: firstTranslation.id,
    });

    await expect(getGeneratedCompanionForSourceLesson(secondVocabulary)).resolves.toMatchObject({
      id: secondTranslation.id,
    });
  });
});
