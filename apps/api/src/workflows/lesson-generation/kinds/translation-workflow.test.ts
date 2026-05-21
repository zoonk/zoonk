import { randomUUID } from "node:crypto";
import { assertStepContent, parseStepContent } from "@zoonk/core/steps/contract/content";
import { prisma } from "@zoonk/db";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { stepFixture } from "@zoonk/testing/fixtures/steps";
import { chapterWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, describe, expect, it } from "vitest";
import { createLessonContext } from "../steps/_test-utils/create-lesson-context";
import { translationLessonWorkflow } from "./translation-workflow";

describe(translationLessonWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  it("stores translation steps from the previous vocabulary lesson", async () => {
    const uniqueId = randomUUID().slice(0, 8);

    const context = await createLessonContext({
      kind: "translation",
      organizationId,
      position: 2,
      targetLanguage: "de",
    });

    const [vocabularyLesson, words] = await Promise.all([
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        organizationId,
        position: 1,
      }),
      Promise.all(
        [`guten-${uniqueId}`, `morgen-${uniqueId}`].map((word) =>
          wordFixture({ organizationId, targetLanguage: "de", word }),
        ),
      ),
    ]);

    const chapterWords = await Promise.all(
      words.map(async (word, position) => {
        const chapterWord = await chapterWordFixture({
          sourceLessonId: vocabularyLesson.id,
          translation: `${word.word} translation`,
          userLanguage: "en",
          wordId: word.id,
        });

        await stepFixture({
          chapterWordId: chapterWord.id,
          content: assertStepContent("vocabulary", {}),
          isPublished: true,
          kind: "vocabulary",
          lessonId: vocabularyLesson.id,
          position,
          wordId: word.id,
        });

        return chapterWord;
      }),
    );

    await translationLessonWorkflow(context);

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: context.id },
    });

    expect(
      steps.map((step) => [step.position, step.kind, step.wordId, step.chapterWordId]),
    ).toStrictEqual([
      [0, "translation", words[0]?.id, chapterWords[0]?.id],
      [1, "translation", words[1]?.id, chapterWords[1]?.id],
    ]);

    expect(steps.map((step) => parseStepContent("translation", step.content))).toStrictEqual([
      {},
      {},
    ]);
  });
});
