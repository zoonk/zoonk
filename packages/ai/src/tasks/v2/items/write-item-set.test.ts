import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { withItemRules } from "./item-rules";
import { toSetItem, writeItemSet } from "./write-item-set";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./write-item-set.prompt.md", () => ({ default: "# Set" }));

vi.mock("./item-rules", () => ({
  withItemRules: vi.fn((taskPrompt: string) => `${taskPrompt}\n# Rules`),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const SKILLS = [
  { description: "Infer what a text implies.", level: "intermediate" as const, name: "Inference" },
  { description: "Find a text's main idea.", level: "intermediate" as const, name: "Main idea" },
];

describe(writeItemSet, () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        kind: "text",
        questions: [],
        text: "",
        title: null,
        visual: null,
      }),
    );
  });

  it("writes Cebraspe statements on a shared text with the item rules and no picture rules", async () => {
    const { userPrompt } = await writeItemSet({
      examFormat: { name: "Cebraspe", style: "Certo ou errado" },
      format: "trueFalse",
      language: "pt",
      questionCount: 9,
      skills: SKILLS,
    });

    expect(withItemRules).toHaveBeenCalledWith("# Set", {
      field: false,
      formats: ["trueFalse"],
      languageGoal: false,
      pictures: false,
    });

    expect(userPrompt).toContain("QUESTION_COUNT: 5");
    expect(userPrompt).toContain("EXAM: Cebraspe");
    expect(userPrompt).toContain("1. SKILL: Inference");
    expect(userPrompt).not.toMatch(/OPTION_COUNT|USED_TITLES/u);
  });

  it("gives an exam's option count, and the titles the skills' sets already use", async () => {
    const { userPrompt } = await writeItemSet({
      examFormat: { name: "ENEM", optionCount: 5, style: "ENEM style" },
      format: "multipleChoice",
      language: "pt",
      questionCount: 3,
      skills: SKILLS,
      usedTitles: ["A biblioteca de domingo", "O rio da cidade"],
    });

    expect(userPrompt).toContain("OPTION_COUNT: 5");
    expect(userPrompt).toContain("USED_TITLES: A biblioteca de domingo | O rio da cidade");
  });
});

describe(toSetItem, () => {
  it("stores a set's question without its skill number or evidence, and with no support of its own", () => {
    expect(
      toSetItem({
        difficulty: "medium",
        evidence: "Visits rose by a third.",
        format: "trueFalse",
        isTrue: true,
        misconception: null,
        reason: "The text says visits rose by a third.",
        skill: 1,
        statement: "Visits rose after the library opened on Sundays.",
      }),
    ).toStrictEqual({
      context: null,
      difficulty: "medium",
      format: "trueFalse",
      image: null,
      isTrue: true,
      misconception: null,
      reason: "The text says visits rose by a third.",
      statement: "Visits rose after the library opened on Sundays.",
      visual: null,
    });
  });

  it("shows the exam's real past questions to match in difficulty", async () => {
    const { userPrompt } = await writeItemSet({
      examFormat: {
        name: "ENEM",
        optionCount: 5,
        pastQuestions: ["Leia o texto.\nO autor defende"],
        style: "ENEM",
      },
      format: "multipleChoice",
      language: "pt",
      questionCount: 3,
      skills: SKILLS,
    });

    expect(userPrompt).toContain("PAST_QUESTIONS:\n    1. Leia o texto. O autor defende");
  });
});
