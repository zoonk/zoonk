import { generateLessonGrammar } from "@zoonk/ai/tasks/lessons/language/grammar";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateGrammarStep } from "./generate-grammar-step";

vi.mock("@zoonk/ai/tasks/lessons/language/grammar", () => ({
  generateLessonGrammar: vi
    .fn()
    .mockResolvedValue({
      data: {
        examples: [{ highlight: "猫", sentence: "猫がいます", translation: "There is a cat." }],
        explanations: [{ text: "Use がいます for living things.", title: "Living things" }],
        questions: [
          {
            answer: "猫",
            distractors: ["犬"],
            feedback: "Use the noun before がいます.",
            question: "Which noun completes the sentence?",
            template: "[BLANK]がいます",
          },
        ],
      },
    }),
}));

describe(generateGrammarStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates grammar content with target and user language context", async () => {
    const context = await createLessonContext({
      kind: "grammar",
      organizationId,
      targetLanguage: "ja",
    });

    const grammarContent = await generateGrammarStep(context);

    expect(grammarContent.explanations).toStrictEqual([
      { text: "Use がいます for living things.", title: "Living things" },
    ]);

    expect(generateLessonGrammar).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja", userLanguage: "en" }),
    );
  });
});
