import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, test, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateLessonRomanizations } from "./_utils/generate-lesson-romanizations";
import { generateGrammarRomanizationStep } from "./generate-grammar-romanization-step";

vi.mock("./_utils/generate-lesson-romanizations", () => ({
  generateLessonRomanizations: vi
    .fn()
    .mockImplementation(({ texts }) =>
      Promise.resolve(Object.fromEntries(texts.map((text: string) => [text, `${text} romanized`]))),
    ),
}));

describe(generateGrammarRomanizationStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates grammar sentence and option romanizations", async () => {
    const context = await createLessonContext({
      kind: "grammar",
      organizationId,
      targetLanguage: "ja",
    });
    const catWord = "猫";
    const dogWord = "犬";
    const grammarSentence = "猫がいます";
    const grammarContent = {
      examples: [{ highlight: catWord, sentence: grammarSentence }],
      exercises: [{ answer: catWord, distractors: [dogWord], template: "[BLANK]がいます" }],
    };

    const romanizations = await generateGrammarRomanizationStep({ context, grammarContent });

    expect(romanizations.romanizations).toEqual({
      [catWord]: `${catWord} romanized`,
      [dogWord]: `${dogWord} romanized`,
      [grammarSentence]: `${grammarSentence} romanized`,
    });
    expect(generateLessonRomanizations).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja" }),
    );
  });
});
