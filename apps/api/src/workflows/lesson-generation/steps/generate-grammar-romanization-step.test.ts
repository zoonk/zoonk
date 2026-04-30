import { generateLessonRomanization } from "@zoonk/ai/tasks/lessons/language/romanization";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateGrammarRomanizationStep } from "./generate-grammar-romanization-step";

vi.mock("@zoonk/ai/tasks/lessons/language/romanization", () => ({
  generateLessonRomanization: vi
    .fn()
    .mockImplementation(({ texts }) =>
      Promise.resolve({
        data: { romanizations: texts.map((text: string) => `${text} romanized`) },
      }),
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

  it("generates grammar sentence and option romanizations", async () => {
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

    expect(romanizations.romanizations).toStrictEqual({
      [catWord]: `${catWord} romanized`,
      [dogWord]: `${dogWord} romanized`,
      [grammarSentence]: `${grammarSentence} romanized`,
    });
    expect(generateLessonRomanization).toHaveBeenCalledWith({
      targetLanguage: "ja",
      texts: [grammarSentence, grammarSentence, catWord, dogWord],
    });
  });
});
