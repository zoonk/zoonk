import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateLessonRomanizations } from "./_utils/generate-lesson-romanizations";
import { generateVocabularyRomanizationStep } from "./generate-vocabulary-romanization-step";

vi.mock("./_utils/generate-lesson-romanizations", () => ({
  generateLessonRomanizations: vi
    .fn()
    .mockImplementation(({ texts }) =>
      Promise.resolve(Object.fromEntries(texts.map((text: string) => [text, `${text} romanized`]))),
    ),
}));

describe(generateVocabularyRomanizationStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates romanizations for vocabulary words", async () => {
    const context = await createLessonContext({ organizationId, targetLanguage: "ja" });
    const catWord = "猫";
    const dogWord = "犬";
    const words = [catWord, dogWord];

    await expect(generateVocabularyRomanizationStep({ context, words })).resolves.toEqual({
      romanizations: {
        [catWord]: `${catWord} romanized`,
        [dogWord]: `${dogWord} romanized`,
      },
    });
    expect(generateLessonRomanizations).toHaveBeenCalledWith({
      targetLanguage: "ja",
      texts: words,
    });
  });
});
