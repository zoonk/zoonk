import { generateLessonGrammar } from "@zoonk/ai/tasks/lessons/language/grammar";
import { generateLessonRomanization } from "@zoonk/ai/tasks/lessons/language/romanization";
import { prisma } from "@zoonk/db";
import { aiOrganizationFixture } from "@zoonk/testing/fixtures/orgs";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { createLessonContext } from "../steps/_test-utils/create-lesson-context";
import { grammarLessonWorkflow } from "./grammar-workflow";

vi.mock("@zoonk/ai/tasks/lessons/language/grammar", () => ({
  generateLessonGrammar: vi
    .fn()
    .mockResolvedValue({
      data: {
        examples: [{ highlight: "猫", sentence: "猫がいます", translation: "There is a cat." }],
        explanations: [
          { text: "Use がいます to say that a living thing exists.", title: "Existence" },
        ],
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

vi.mock("@zoonk/ai/tasks/lessons/language/romanization", () => ({
  generateLessonRomanization: vi
    .fn()
    .mockImplementation(({ texts }) =>
      Promise.resolve({
        data: { romanizations: texts.map((text: string) => `${text} romanized`) },
      }),
    ),
}));

describe(grammarLessonWorkflow, () => {
  let organizationId: string;

  beforeAll(async () => {
    const organization = await aiOrganizationFixture();
    organizationId = organization.id;
  });

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("stores grammar explanations, examples, and exercises", async () => {
    const context = await createLessonContext({
      kind: "grammar",
      organizationId,
      targetLanguage: "ja",
    });

    await grammarLessonWorkflow(context);

    expect(generateLessonGrammar).toHaveBeenCalledOnce();

    expect(generateLessonRomanization).toHaveBeenCalledWith(
      expect.objectContaining({ texts: expect.arrayContaining(["猫がいます", "猫", "犬"]) }),
    );

    const steps = await prisma.step.findMany({
      orderBy: { position: "asc" },
      where: { lessonId: context.id },
    });

    expect(steps.map((step) => [step.position, step.kind])).toStrictEqual([
      [0, "static"],
      [1, "static"],
      [2, "fillBlank"],
    ]);

    expect(steps[0]?.content).toStrictEqual({
      text: "Use がいます to say that a living thing exists.",
      title: "Existence",
      variant: "text",
    });

    expect(steps[1]?.content).toStrictEqual({
      highlight: "猫",
      romanization: "猫がいます romanized",
      sentence: "猫がいます",
      translation: "There is a cat.",
      variant: "grammarExample",
    });

    expect(steps[2]?.content).toStrictEqual({
      answers: ["猫"],
      distractors: ["犬"],
      feedback: "Use the noun before がいます.",
      question: "Which noun completes the sentence?",
      romanizations: Object.fromEntries([
        ["犬", "犬 romanized"],
        ["猫", "猫 romanized"],
        ["猫がいます", "猫がいます romanized"],
      ]),
      template: "[BLANK]がいます",
    });
  });
});
