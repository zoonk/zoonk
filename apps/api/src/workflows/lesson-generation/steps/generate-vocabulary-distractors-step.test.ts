import { generateLessonDistractors } from "@zoonk/ai/tasks/lessons/language/distractors";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateVocabularyDistractorsStep } from "./generate-vocabulary-distractors-step";

vi.mock("@zoonk/ai/tasks/lessons/language/distractors", () => ({
  generateLessonDistractors: vi
    .fn()
    .mockImplementation(({ input }) =>
      Promise.resolve({ data: { distractors: [`${input} alt`] } }),
    ),
}));

describe(generateVocabularyDistractorsStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates distractors for vocabulary words", async () => {
    const context = await createLessonContext({ organizationId, targetLanguage: "ja" });
    const catWord = "猫";

    await expect(
      generateVocabularyDistractorsStep({
        context,
        words: [{ translation: "cat", word: catWord }],
      }),
    ).resolves.toStrictEqual({ distractors: { [catWord]: [`${catWord} alt`] } });

    expect(generateLessonDistractors).toHaveBeenCalledWith({
      input: catWord,
      language: "ja",
      shape: "any",
      translation: { language: "en", text: "cat" },
    });
  });
});
