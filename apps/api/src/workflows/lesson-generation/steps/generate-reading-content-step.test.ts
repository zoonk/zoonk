import { randomUUID } from "node:crypto";
import { generateLessonSentences } from "@zoonk/ai/tasks/lessons/language/sentences";
import { lessonFixture } from "@zoonk/testing/fixtures/lessons";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
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

  it("generates reading content from vocabulary lesson metadata since the previous reading", async () => {
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
        description: `Old vocabulary ${uniqueId}`,
        generationStatus: "completed",
        isPublished: true,
        kind: "vocabulary",
        organizationId,
        position: 0,
        title: `Old Vocabulary ${uniqueId}`,
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
        description: `Current vocabulary ${uniqueId}`,
        generationStatus: "pending",
        isPublished: true,
        kind: "vocabulary",
        organizationId,
        position: 2,
        title: `Current Vocabulary ${uniqueId}`,
      }),
    ]);

    const result = await generateReadingContentStep(context);

    expect(previousReading.position).toBe(1);
    expect(oldVocabularyLesson.position).toBe(0);

    expect(result).toStrictEqual({
      kind: "reading",
      sentences: [
        { explanation: "Uses both words.", sentence: "猫と水", translation: "cat and water" },
      ],
    });

    const sentenceInput = vi.mocked(generateLessonSentences).mock.calls[0]?.[0];

    expect(sentenceInput?.sourceLessons).toStrictEqual([
      { description: `Current vocabulary ${uniqueId}`, title: `Current Vocabulary ${uniqueId}` },
    ]);

    expect(sentenceInput?.lessonTitle).toBe(context.title);
    expect(currentVocabularyLesson.generationStatus).toBe("pending");
  });
});
