import { randomUUID } from "node:crypto";
import { generateLessonSentences } from "@zoonk/ai/tasks/lessons/language/sentences";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { lessonWordFixture, wordFixture } from "@zoonk/testing/fixtures/words";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateReadingContentStep } from "./generate-reading-content-step";

vi.mock("@zoonk/ai/tasks/lessons/language/sentences", () => ({
  generateLessonSentences: vi
    .fn()
    .mockResolvedValue({
      data: {
        sentences: [
          { explanation: "Uses both words.", sentence: "猫と水", translation: "cat and water" },
        ],
      },
    }),
}));

describe(generateReadingContentStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates reading content from vocabulary lessons since the previous reading", async () => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);

    const context = await createLessonContext({
      kind: "reading",
      organizationId,
      position: 4,
      targetLanguage: "ja",
    });

    const [oldVocabularyLesson, previousReading, currentVocabularyLesson] = await Promise.all([
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        organizationId,
        position: 0,
      }),
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "completed",
        isPublished: true,
        kind: "reading",
        organizationId,
        position: 1,
      }),
      lessonFixture({
        chapterId: context.chapterId,
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        organizationId,
        position: 2,
      }),
    ]);

    const [oldWord, catWord, waterWord] = await Promise.all([
      wordFixture({ organizationId, targetLanguage: "ja", word: `古い${uniqueId}` }),
      wordFixture({ organizationId, targetLanguage: "ja", word: `猫${uniqueId}` }),
      wordFixture({ organizationId, targetLanguage: "ja", word: `水${uniqueId}` }),
    ]);

    await Promise.all([
      lessonWordFixture({
        lessonId: oldVocabularyLesson.id,
        translation: "old",
        userLanguage: "en",
        wordId: oldWord.id,
      }),
      lessonWordFixture({
        lessonId: currentVocabularyLesson.id,
        translation: "cat",
        userLanguage: "en",
        wordId: catWord.id,
      }),
      lessonWordFixture({
        lessonId: currentVocabularyLesson.id,
        translation: "water",
        userLanguage: "en",
        wordId: waterWord.id,
      }),
    ]);

    const result = await generateReadingContentStep(context);

    expect(previousReading.position).toBe(1);

    expect(result).toStrictEqual({
      kind: "reading",
      sentences: [
        { explanation: "Uses both words.", sentence: "猫と水", translation: "cat and water" },
      ],
    });

    const sentenceInput = vi.mocked(generateLessonSentences).mock.calls[0]?.[0];

    expect(sentenceInput?.words).toStrictEqual(
      expect.arrayContaining([`猫${uniqueId}`, `水${uniqueId}`]),
    );

    expect(sentenceInput?.words).toHaveLength(2);
  });
});
