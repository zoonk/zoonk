import { beforeEach, describe, expect, test, vi } from "vitest";
import { generateGrammarContentStep } from "../steps/generate-grammar-content-step";
import { generateGrammarRomanizationStep } from "../steps/generate-grammar-romanization-step";
import { generateGrammarUserContentStep } from "../steps/generate-grammar-user-content-step";
import { saveGrammarLessonStep } from "../steps/save-grammar-lesson-step";
import { createKindWorkflowContext } from "./_test-utils/create-kind-workflow-context";
import { grammarLessonWorkflow } from "./grammar-workflow";

const { grammarContent, userContent } = vi.hoisted(() => ({
  grammarContent: {
    examples: [{ highlight: "猫", sentence: "猫がいます" }],
    exercises: [{ answer: "猫", distractors: ["犬"], template: "[BLANK]がいます" }],
  },
  userContent: {
    discovery: { context: "", options: [], question: "" },
    exampleTranslations: ["There is a cat."],
    exerciseFeedback: ["Use the noun."],
    exerciseQuestions: ["Which noun fits?"],
    exerciseTranslations: ["There is a cat."],
    ruleName: "Existence",
    ruleSummary: "Use がいます.",
  },
}));

vi.mock("../steps/generate-grammar-content-step", () => ({
  generateGrammarContentStep: vi.fn().mockResolvedValue(grammarContent),
}));

vi.mock("../steps/generate-grammar-user-content-step", () => ({
  generateGrammarUserContentStep: vi.fn().mockResolvedValue(userContent),
}));

vi.mock("../steps/generate-grammar-romanization-step", () => ({
  generateGrammarRomanizationStep: vi.fn().mockResolvedValue({
    romanizations: { 猫がいます: "neko ga imasu" },
  }),
}));

vi.mock("../steps/save-grammar-lesson-step", () => ({
  saveGrammarLessonStep: vi.fn(),
}));

describe(grammarLessonWorkflow, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("generates grammar content, user content, romanization, and saves grammar", async () => {
    const context = await createKindWorkflowContext();

    await grammarLessonWorkflow(context);

    expect(generateGrammarContentStep).toHaveBeenCalledExactlyOnceWith(context);
    expect(generateGrammarUserContentStep).toHaveBeenCalledWith({ context, grammarContent });
    expect(generateGrammarRomanizationStep).toHaveBeenCalledWith({ context, grammarContent });
    expect(saveGrammarLessonStep).toHaveBeenCalledWith(
      expect.objectContaining({
        context,
        grammarContent,
        romanizations: { 猫がいます: "neko ga imasu" },
        userContent,
      }),
    );
  });
});
