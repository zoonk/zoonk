import { generateLessonGrammarContent } from "@zoonk/ai/tasks/lessons/language/grammar-content";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "./_test-utils/create-lesson-context";
import { generateGrammarContentStep } from "./generate-grammar-content-step";

vi.mock("@zoonk/ai/tasks/lessons/language/grammar-content", () => ({
  generateLessonGrammarContent: vi
    .fn()
    .mockResolvedValue({
      data: {
        examples: [{ highlight: "猫", sentence: "猫がいます" }],
        exercises: [{ answer: "猫", distractors: ["犬"], template: "[BLANK]がいます" }],
      },
    }),
}));

describe(generateGrammarContentStep, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("generates grammar content with target language context", async () => {
    const context = await createLessonContext({
      kind: "grammar",
      organizationId,
      targetLanguage: "ja",
    });

    const grammarContent = await generateGrammarContentStep(context);

    expect(grammarContent.examples).toStrictEqual([{ highlight: "猫", sentence: "猫がいます" }]);
    expect(generateLessonGrammarContent).toHaveBeenCalledWith(
      expect.objectContaining({ targetLanguage: "ja" }),
    );
  });
});
