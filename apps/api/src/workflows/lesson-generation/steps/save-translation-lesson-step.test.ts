import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { chapterWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { saveTranslationLessonStep } from "./save-translation-lesson-step";

describe(saveTranslationLessonStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("creates translation steps for the vocabulary companion lesson", async () => {
    const context = await createLessonContext({
      kind: "vocabulary",
      organizationId,
      position: 1,
      targetLanguage: "pt",
    });

    const [translationLesson, firstWord, secondWord] = await Promise.all([
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "pending",
        isPublished: true,
        kind: "translation",
        organizationId,
        position: 2,
      }),
      wordFixture({ organizationId, targetLanguage: "pt", word: `word-a-${randomUUID()}` }),
      wordFixture({ organizationId, targetLanguage: "pt", word: `word-b-${randomUUID()}` }),
    ]);

    const [firstChapterWord, secondChapterWord] = await Promise.all([
      chapterWordFixture({ sourceLessonId: context.id, wordId: firstWord.id }),
      chapterWordFixture({ sourceLessonId: context.id, wordId: secondWord.id }),
    ]);

    await Promise.all([
      stepFixture({
        chapterWordId: firstChapterWord.id,
        content: {},
        kind: "vocabulary",
        lessonId: context.id,
        position: 0,
        wordId: firstWord.id,
      }),
      stepFixture({
        chapterWordId: secondChapterWord.id,
        content: {},
        kind: "vocabulary",
        lessonId: context.id,
        position: 1,
        wordId: secondWord.id,
      }),
    ]);

    await saveTranslationLessonStep(context);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { kind: "translation", lessonId: translationLesson.id },
    });

    expect(steps.map((step) => [step.position, step.wordId, step.chapterWordId])).toStrictEqual([
      [0, firstWord.id, firstChapterWord.id],
      [1, secondWord.id, secondChapterWord.id],
    ]);

    const dbTranslationLesson = await prisma.lesson.findUniqueOrThrow({
      where: { id: translationLesson.id },
    });

    expect(dbTranslationLesson.generationStatus).toBe("completed");
  });

  it("does nothing when vocabulary has no translation companion", async () => {
    const context = await createLessonContext({
      kind: "vocabulary",
      organizationId,
      position: 1,
      targetLanguage: "pt",
    });

    await expect(saveTranslationLessonStep(context)).resolves.toBeUndefined();
  });
});
