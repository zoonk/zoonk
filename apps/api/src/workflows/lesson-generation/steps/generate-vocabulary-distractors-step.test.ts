import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateDirectDistractors } from "./_utils/generate-direct-distractors";
import { generateVocabularyDistractorsStep } from "./generate-vocabulary-distractors-step";

vi.mock("./_utils/generate-direct-distractors", () => ({
  generateDirectDistractors: vi
    .fn()
    .mockImplementation(({ entries }) =>
      Promise.resolve(
        Object.fromEntries(
          entries.map((entry: { key: string }) => [entry.key, [`${entry.key} alt`]]),
        ),
      ),
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

  test("generates distractors for vocabulary words", async () => {
    const context = await createLessonContext({ organizationId, targetLanguage: "ja" });
    const catWord = "猫";

    await expect(
      generateVocabularyDistractorsStep({
        context,
        words: [{ translation: "cat", word: catWord }],
      }),
    ).resolves.toEqual({ distractors: { [catWord]: [`${catWord} alt`] } });
    expect(generateDirectDistractors).toHaveBeenCalledWith(
      expect.objectContaining({ language: "ja", shape: "any" }),
    );
  });
});
