import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { formatCast } from "../_utils/cast";
import { withItemRules } from "./item-rules";
import { generatePlacementItems } from "./placement-items";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./placement-items.prompt.md", () => ({
  default:
    "# Goal\n\n{{#quick}}Quick.\n{{/quick}}{{#trueFalse}}Half true.\n{{/trueFalse}}{{#taps}}Taps.\n{{/taps}}",
}));

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
  quickCount: 1,
  tapCount: 0,
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

  it("writes a mock's quick questions with no tap rules, lines or list", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({ skills: [{ quick: [quickItem], skill: 1 }] }),
    );

    const { data, systemPrompt, userPrompt } = await generatePlacementItems({
      country: null,
      examFormat: { name: "ENEM", optionCount: 5, style: "ENEM style" },
      language: "pt",
      quickFormat: "multipleChoice",
      skills: [{ ...skill, quickCount: 2 }],
    });

    expect(systemPrompt).toBe("# Goal\n\nQuick.\n\n# Rules");

    expect(withItemRules).toHaveBeenCalledWith(expect.any(String), {
      field: false,
      formats: ["multipleChoice"],
      languageGoal: false,
      usedSituations: false,
    });

    expect(userPrompt).toContain("OPTION_COUNT: 5");
    expect(userPrompt).toContain("QUICK_COUNT: 2");
    expect(userPrompt).not.toMatch(/TAP_COUNT|TARGET_LANGUAGE|FIELD/u);
    expect(data.skills).toStrictEqual([{ quick: [quickItem], taps: [] }]);
    await expect(writtenSkillFields()).resolves.toStrictEqual(["skill", "quick"]);
  });

  it("writes placement's tap confirmations with their rules and turns select-all into multiple choice", async () => {
    const order = {
      difficulty: "medium",
      format: "order",
      question: "Order the steps.",
      reason: "Why.",
      steps: ["a", "b", "c", "d"],
    };

    const option = { isCorrect: true, misconception: null, reason: "Right.", text: "x" };

    const selectAll = {
      context: null,
      difficulty: "hard",
      format: "selectAll",
      options: [option, option, option, option, option],
      question: "Which apply?",
    };

    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({ skills: [{ quick: [], skill: 1, taps: [order, selectAll] }] }),
    );

    const { data, systemPrompt, userPrompt } = await generatePlacementItems({
      country: null,
      language: "pt",
      quickFormat: "trueFalse",
      skills: [{ ...skill, tapCount: 3 }],
      targetLanguage: "en",
    });

    expect(systemPrompt).toBe("# Goal\n\nQuick.\nHalf true.\nTaps.\n\n# Rules");

    expect(withItemRules).toHaveBeenCalledWith(expect.any(String), {
      field: false,
      formats: ["trueFalse", "matchPairs", "order"],
      languageGoal: true,
      usedSituations: false,
    });

    expect(userPrompt).toContain("QUICK_COUNT: 1\n   TAP_COUNT: 3");
    expect(userPrompt).toMatch(/TARGET_LANGUAGE: \S/u);
    expect(userPrompt).not.toContain("OPTION_COUNT");
    await expect(writtenSkillFields()).resolves.toStrictEqual(["skill", "quick", "taps"]);

    expect(data.skills[0]?.taps).toStrictEqual([
      order,
      {
        context: null,
        difficulty: "hard",
        fixedOrder: false,
        format: "multipleChoice",
        image: null,
        options: selectAll.options,
        question: "Which apply?",
        visual: null,
      },
    ]);
  });

  it("writes only taps when no skill needs a quick question", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({ skills: [{ skill: 1, taps: [] }] }),
    );

    const { systemPrompt, userPrompt } = await generatePlacementItems({
      country: null,
      language: "en",
      quickFormat: "multipleChoice",
      skills: [{ ...skill, quickCount: 0, tapCount: 3 }],
    });

    expect(systemPrompt).toBe("# Goal\n\nTaps.\n\n# Rules");
    expect(userPrompt).not.toMatch(/QUICK_FORMAT|QUICK_COUNT|OPTION_COUNT/u);

    expect(withItemRules).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ formats: ["matchPairs", "order"] }),
    );

    await expect(writtenSkillFields()).resolves.toStrictEqual(["skill", "taps"]);
  });

  it("sets a language goal's questions where the practiced language is spoken", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({ skills: [{ quick: [], skill: 1 }] }),
    );

    const { userPrompt } = await generatePlacementItems({
      country: null,
      language: "pt",
      quickFormat: "multipleChoice",
      skills: [skill],
      targetLanguage: "it",
    });

    expect(userPrompt).toContain("- Place: Italy");
    expect(userPrompt).not.toMatch(/Brazil|Register/u);
    expect(userPrompt).toContain(formatCast({ country: null, language: "it", seed: skill.name }));
  });

  it("lists only the used situations a skill has, and draws another cast once it has some", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({ skills: [{ quick: [], skill: 1 }] }),
    );

    const fresh = { ...skill, name: "Ratios" };

    const used = {
      ...skill,
      usedSituations: ["Ana splits a bill.", "A shop raises prices twice."],
    };

    const { userPrompt } = await generatePlacementItems({
      country: null,
      language: "en",
      quickFormat: "multipleChoice",
      skills: [used, fresh],
    });

    expect(withItemRules).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ usedSituations: true }),
    );

    expect(userPrompt).toContain(
      "LEVEL: intermediate\n   QUICK_COUNT: 1\n   USED_SITUATIONS:\n     - Ana splits a bill.\n     - A shop raises prices twice.\n2. SKILL: Ratios",
    );

    expect(userPrompt.match(/USED_SITUATIONS/gu)).toHaveLength(1);

    expect(userPrompt).not.toContain(
      formatCast({ country: null, language: "en", seed: "Percentages:Ratios" }),
    );
  });
});
