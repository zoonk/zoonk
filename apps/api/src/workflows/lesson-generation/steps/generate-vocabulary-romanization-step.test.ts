import { generateLessonRomanization } from "@zoonk/ai/tasks/lessons/language/romanization";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateVocabularyRomanizationStep } from "./generate-vocabulary-romanization-step";

vi.mock("@zoonk/ai/tasks/lessons/language/romanization", () => ({
  generateLessonRomanization: vi.fn().mockImplementation(({ texts }) =>
    Promise.resolve({
      data: { romanizations: texts.map((text: string) => `${text} romanized`) },
    }),
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
    expect(generateLessonRomanization).toHaveBeenCalledWith({
      targetLanguage: "ja",
      texts: words,
    });
  });
});
