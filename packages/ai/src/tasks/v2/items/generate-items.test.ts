import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { generateItems } from "./generate-items";
import { withItemRules } from "./item-rules";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./generate-items.prompt.md", () => ({ default: "# Goal" }));

vi.mock("./item-rules", () => ({
  withItemRules: vi.fn((taskPrompt: string) => `${taskPrompt}\n# Rules`),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const skill = { description: "Write an argumentative essay.", name: "Redação" };

describe(generateItems, () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ items: [] }));
  });

  it("writes an exam's essay with the essay rules alone, without options, field or language lines", async () => {
    const { userPrompt } = await generateItems({
      examFormat: { name: "ENEM", optionCount: 5, style: "ENEM style" },
      format: "essay",
      language: "pt",
      level: "intermediate",
      skill,
    });

    expect(withItemRules).toHaveBeenCalledWith("# Goal", {
      field: false,
      formats: ["essay"],
      languageGoal: false,
      numericEntry: false,
      severalPicks: false,
    });

    expect(userPrompt).toContain("EXAM: ENEM");
    expect(userPrompt).not.toMatch(/OPTION_COUNT|FIELD|TARGET_LANGUAGE/u);
  });

  it("shows the exam's real past questions to match in difficulty, and none without them", async () => {
    const exam = { name: "Cebraspe", optionCount: null, style: "Certo ou errado." };

    const [withPast, without] = await Promise.all([
      generateItems({
        examFormat: {
          ...exam,
          pastQuestions: ["A lei é válida.\nJulgue o item.", "O ato é nulo."],
        },
        format: "trueFalse",
        language: "pt",
        level: "advanced",
        skill,
      }),
      generateItems({
        examFormat: exam,
        format: "trueFalse",
        language: "pt",
        level: "advanced",
        skill,
      }),
    ]);

    expect(withPast.userPrompt).toContain(
      "PAST_QUESTIONS:\n    1. A lei é válida. Julgue o item.\n    2. O ato é nulo.",
    );

    expect(without.userPrompt).not.toContain("PAST_QUESTIONS");
  });

  it("sets a field's multiple-choice questions in it, with the field rule and the option count", async () => {
    const { userPrompt } = await generateItems({
      field: "nursing",
      format: "multipleChoice",
      language: "en",
      level: "beginner",
      skill,
    });

    expect(withItemRules).toHaveBeenCalledWith("# Goal", {
      field: true,
      formats: ["multipleChoice"],
      languageGoal: false,
      numericEntry: false,
      severalPicks: false,
    });

    expect(userPrompt).toContain("OPTION_COUNT: 4");
    expect(userPrompt).toContain("FIELD: nursing");
  });

  it("asks an exam's several picks and its answer box only when the exam asks that way", async () => {
    const jee = { name: "JEE Advanced", optionCount: 4, style: "JEE style" };

    const picks = await generateItems({
      examFormat: { ...jee, select: "all" },
      format: "multipleChoice",
      language: "en",
      level: "advanced",
      skill,
    });

    expect(withItemRules).toHaveBeenLastCalledWith("# Goal", {
      field: false,
      formats: ["multipleChoice"],
      languageGoal: false,
      numericEntry: false,
      severalPicks: true,
    });

    expect(picks.userPrompt).toContain("SELECT: all");
    expect(picks.userPrompt).not.toContain("ENTRY");

    const integer = await generateItems({
      examFormat: { ...jee, entry: { kind: "integer", places: null }, select: "all" },
      format: "numeric",
      language: "en",
      level: "advanced",
      skill,
    });

    expect(withItemRules).toHaveBeenLastCalledWith("# Goal", {
      field: false,
      formats: ["numeric"],
      languageGoal: false,
      numericEntry: true,
      severalPicks: false,
    });

    expect(integer.userPrompt).toContain("ENTRY: integer");
    expect(integer.userPrompt).not.toMatch(/SELECT|OPTION_COUNT/u);

    const single = await generateItems({
      examFormat: { ...jee, entry: { kind: "number", places: null }, select: 1 },
      format: "multipleChoice",
      language: "en",
      level: "advanced",
      skill,
    });

    expect(single.userPrompt).not.toMatch(/SELECT|ENTRY/u);
  });
});
