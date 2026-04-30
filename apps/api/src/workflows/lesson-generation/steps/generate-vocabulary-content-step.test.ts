import { generateLessonVocabulary } from "@zoonk/ai/tasks/lessons/language/vocabulary";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateVocabularyContentStep } from "./generate-vocabulary-content-step";

vi.mock("@zoonk/ai/tasks/lessons/language/vocabulary", () => ({
  generateLessonVocabulary: vi
    .fn()
    .mockResolvedValue({ data: { words: [{ translation: "cat", word: "猫" }] } }),
}));

describe(generateVocabularyContentStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates vocabulary words with target and user language context", async () => {
    const context = await createLessonContext({ organizationId, targetLanguage: "ja" });

    const result = await generateVocabularyContentStep(context);

    expect(result).toEqual({ kind: "vocabulary", words: [{ translation: "cat", word: "猫" }] });
    expect(generateLessonVocabulary).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja", userLanguage: context.language }),
    );
  });

  test("throws when vocabulary generation has no target language", async () => {
    const context = await createLessonContext({ organizationId, targetLanguage: null });

    await expect(generateVocabularyContentStep(context)).rejects.toThrow(
      "Language lesson generation needs a target language",
    );
  });
});
