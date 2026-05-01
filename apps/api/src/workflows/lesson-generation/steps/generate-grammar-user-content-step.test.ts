import { generateLessonGrammarUserContent } from "@zoonk/ai/tasks/lessons/language/grammar-user-content";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateGrammarUserContentStep } from "./generate-grammar-user-content-step";

vi.mock("@zoonk/ai/tasks/lessons/language/grammar-user-content", () => ({
  generateLessonGrammarUserContent: vi
    .fn()
    .mockResolvedValue({
      data: {
        discovery: {
          context: "Pick the matching pattern.",
          options: [{ feedback: "yes", isCorrect: true, text: "It matches." }],
          question: "Which option matches?",
        },
        exampleTranslations: ["There is a cat."],
        exerciseFeedback: ["Use the noun."],
        exerciseQuestions: ["Which noun fits?"],
        exerciseTranslations: ["There is a cat."],
        ruleName: "Existence",
        ruleSummary: "Use がいます.",
      },
    }),
}));

describe(generateGrammarUserContentStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates grammar user content with target and user language context", async () => {
    const context = await createLessonContext({
      kind: "grammar",
      organizationId,
      targetLanguage: "ja",
    });

    const grammarContent = {
      examples: [{ highlight: "猫", sentence: "猫がいます" }],
      exercises: [{ answer: "猫", distractors: ["犬"], template: "[BLANK]がいます" }],
    };

    const userContent = await generateGrammarUserContentStep({ context, grammarContent });

    expect(userContent.ruleName).toBe("Existence");

    expect(generateLessonGrammarUserContent).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja", userLanguage: "en" }),
    );
  });
});
