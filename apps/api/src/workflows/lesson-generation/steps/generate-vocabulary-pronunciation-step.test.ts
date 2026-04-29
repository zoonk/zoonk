import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateWordPronunciations } from "./_utils/generate-word-pronunciations";
import { generateVocabularyPronunciationStep } from "./generate-vocabulary-pronunciation-step";

vi.mock("./_utils/generate-word-pronunciations", () => ({
  generateWordPronunciations: vi
    .fn()
    .mockImplementation(({ words }) =>
      Promise.resolve(Object.fromEntries(words.map((word: string) => [word, `${word} pron`]))),
    ),
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

  test("generates pronunciations for vocabulary words", async () => {
    const context = await createLessonContext({ organizationId, targetLanguage: "ja" });
    const catWord = "猫";
    const dogWord = "犬";
    const words = [catWord, dogWord];

    await expect(generateVocabularyPronunciationStep({ context, words })).resolves.toEqual({
      pronunciations: {
        [catWord]: `${catWord} pron`,
        [dogWord]: `${dogWord} pron`,
      },
    });
    expect(generateWordPronunciations).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja", userLanguage: context.language, words }),
    );
  });
});
