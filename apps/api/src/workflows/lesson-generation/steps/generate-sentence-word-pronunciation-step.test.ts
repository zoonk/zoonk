import { randomUUID } from "node:crypto";
import { generateLessonPronunciation } from "@zoonk/ai/tasks/lessons/language/pronunciation";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateSentenceWordPronunciationStep } from "./generate-sentence-word-pronunciation-step";

vi.mock("@zoonk/ai/tasks/lessons/language/pronunciation", () => ({
  generateLessonPronunciation: vi.fn().mockImplementation(({ word }) =>
    Promise.resolve({
      data: { pronunciation: `${word} pron` },
    }),
  ),
}));

describe(generateSentenceWordPronunciationStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates pronunciations for reading words", async () => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const catWord = `猫${uniqueId}`;
    const fireWord = `火${uniqueId}`;
    const waterWord = `水${uniqueId}`;
    const context = await createLessonContext({
      kind: "reading",
      organizationId,
      targetLanguage: "ja",
    });
    const words = [catWord, waterWord, fireWord];

    await expect(generateSentenceWordPronunciationStep({ context, words })).resolves.toEqual({
      pronunciations: {
        [catWord]: `${catWord} pron`,
        [fireWord]: `${fireWord} pron`,
        [waterWord]: `${waterWord} pron`,
      },
    });
    expect(generateLessonPronunciation).toHaveBeenCalledTimes(3);
    expect(generateLessonPronunciation).toHaveBeenCalledWith({
      targetLanguage: "ja",
      userLanguage: context.language,
      word: catWord,
    });
  });
});
