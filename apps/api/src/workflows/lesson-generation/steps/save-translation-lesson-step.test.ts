import { randomUUID } from "node:crypto";
import { prisma } from "@zoonk/db";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { saveTranslationLessonStep } from "./save-translation-lesson-step";

describe(saveTranslationLessonStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("creates translation steps from the previous completed vocabulary lesson", async () => {
    const context = await createLessonContext({
      kind: "translation",
      organizationId,
      position: 2,
      targetLanguage: "pt",
    });

    const [vocabularyLesson, firstWord, secondWord] = await Promise.all([
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        organizationId,
        position: 1,
      }),
      wordFixture({ organizationId, targetLanguage: "pt", word: `word-a-${randomUUID()}` }),
      wordFixture({ organizationId, targetLanguage: "pt", word: `word-b-${randomUUID()}` }),
    ]);

    await Promise.all([
      stepFixture({
        content: {},
        kind: "vocabulary",
        lessonId: vocabularyLesson.id,
        position: 0,
        wordId: firstWord.id,
      }),
      stepFixture({
        content: {},
        kind: "vocabulary",
        lessonId: vocabularyLesson.id,
        position: 1,
        wordId: secondWord.id,
      }),
    ]);

    await saveTranslationLessonStep(context);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { kind: "translation", lessonId: context.id },
    });

    expect(steps.map((step) => [step.position, step.wordId])).toStrictEqual([
      [0, firstWord.id],
      [1, secondWord.id],
    ]);
  });

  it("throws when a translation lesson has no completed vocabulary source", async () => {
    const context = await createLessonContext({
      kind: "translation",
      organizationId,
      position: 2,
      targetLanguage: "pt",
    });

    await expect(saveTranslationLessonStep(context)).rejects.toThrow(
      "Translation generation needs a completed vocabulary lesson",
    );
  });
});
