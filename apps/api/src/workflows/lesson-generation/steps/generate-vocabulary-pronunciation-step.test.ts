import { randomUUID } from "node:crypto";
import { generateLessonPronunciation } from "@zoonk/ai/tasks/lessons/language/pronunciation";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateVocabularyPronunciationStep } from "./generate-vocabulary-pronunciation-step";

vi.mock("@zoonk/ai/tasks/lessons/language/pronunciation", () => ({
  generateLessonPronunciation: vi
    .fn()
    .mockImplementation(({ word }) => Promise.resolve({ data: { pronunciation: `${word} pron` } })),
}));

describe(generateVocabularyPronunciationStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates pronunciations for vocabulary words", async () => {
    const uniqueId = randomUUID().replaceAll("-", "").slice(0, 8);
    const context = await createLessonContext({ organizationId, targetLanguage: "ja" });
    const catWord = `猫${uniqueId}`;
    const dogWord = `犬${uniqueId}`;
    const words = [catWord, dogWord];

    await expect(generateVocabularyPronunciationStep({ context, words })).resolves.toEqual({
      pronunciations: { [catWord]: `${catWord} pron`, [dogWord]: `${dogWord} pron` },
    });
    expect(generateLessonPronunciation).toHaveBeenCalledWith({
      targetLanguage: "ja",
      userLanguage: context.language,
      word: catWord,
    });
    expect(generateLessonPronunciation).toHaveBeenCalledWith({
      targetLanguage: "ja",
      userLanguage: context.language,
      word: dogWord,
    });
  });
});
