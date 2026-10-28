import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { withItemRules } from "./item-rules";
import { generatePlacementItems } from "./placement-items";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./placement-items.prompt.md", () => ({
  default:
    "# Goal\n\n`QUICK_COUNT` quick{{TYPED_GOAL}} each.\n\n- Used situations.\n{{TYPED_CHECK}}\n- Medium.\n{{TRUE_FALSE_BALANCE}}\n{{TYPED_ANSWERS}}\n",
}));

vi.mock("./placement-items-typed-check.prompt.md", () => ({ default: "- Typed confirms.\n" }));
vi.mock("./placement-items-true-false.prompt.md", () => ({ default: "- Half true.\n" }));
vi.mock("./placement-items-typed-answers.prompt.md", () => ({ default: "- Accepted answers.\n" }));

vi.mock("./item-rules", () => ({
  withItemRules: vi.fn((taskPrompt: string) => `${taskPrompt}\n# Rules`),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const skill = {
  description: "Successive percentages.",
  level: "intermediate",
  name: "Percentages",
} as const;

const quickItem = {
  context: null,
  difficulty: "medium",
  format: "multipleChoice",
  image: null,
  options: [],
  question: "Q?",
  visual: null,
};

const responseFormatSchema = z.object({
  schema: z.object({
    properties: z.object({
      skills: z.object({ items: z.object({ properties: z.record(z.string(), z.unknown()) }) }),
    }),
  }),
});

async function writtenSkillFields(): Promise<string[]> {
  const format = await vi.mocked(generateText).mock.calls[0]?.[0].output?.responseFormat;
  return Object.keys(responseFormatSchema.parse(format).schema.properties.skills.items.properties);
}

describe(generatePlacementItems, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("writes a mock's quick questions with no typed rules, lines or list", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({ skills: [{ quick: [quickItem], skill: 1 }] }),
    );

    const { data, systemPrompt, userPrompt } = await generatePlacementItems({
      examFormat: { name: "ENEM", optionCount: 5, style: "ENEM style" },
      language: "pt",
      quickCount: 2,
      quickFormat: "multipleChoice",
      skills: [skill],
      typedCount: 0,
    });

    expect(systemPrompt).toBe(
      "# Goal\n\n`QUICK_COUNT` quick each.\n\n- Used situations.\n- Medium.\n\n# Rules",
    );

    expect(withItemRules).toHaveBeenCalledWith(expect.any(String), {
      field: false,
      formats: ["multipleChoice"],
      languageGoal: false,
    });

    expect(userPrompt).toContain("OPTION_COUNT: 5");
    expect(userPrompt).not.toMatch(/TYPED_COUNT|TARGET_LANGUAGE|FIELD/u);
    expect(data.skills).toStrictEqual([{ quick: [quickItem], typed: [] }]);
    await expect(writtenSkillFields()).resolves.toStrictEqual(["skill", "quick"]);
  });

  it("writes placement's typed confirmations and a language goal's questions with their rules", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({ skills: [{ quick: [], skill: 1, typed: [] }] }),
    );

    const { systemPrompt, userPrompt } = await generatePlacementItems({
      language: "pt",
      quickCount: 1,
      quickFormat: "trueFalse",
      skills: [skill],
      targetLanguage: "en",
      typedCount: 1,
    });

    expect(systemPrompt).toBe(
      "# Goal\n\n`QUICK_COUNT` quick and exactly `TYPED_COUNT` in the `typed` format each.\n\n- Used situations.\n- Typed confirms.\n- Medium.\n- Half true.\n- Accepted answers.\n\n# Rules",
    );

    expect(withItemRules).toHaveBeenCalledWith(expect.any(String), {
      field: false,
      formats: ["trueFalse", "typed"],
      languageGoal: true,
    });

    expect(userPrompt).toContain("TYPED_COUNT: 1");
    expect(userPrompt).toMatch(/TARGET_LANGUAGE: \S/u);
    expect(userPrompt).not.toContain("OPTION_COUNT");
    await expect(writtenSkillFields()).resolves.toStrictEqual(["skill", "quick", "typed"]);
  });
});
