import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { getWritingGrader, gradeWritingEvidence } from "./grade-essay";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("../_utils/address-form.prompt.md", () => ({
  default: "{{#neutral}}Neutral address.{{/neutral}}",
}));

vi.mock("../_utils/regional-forms.prompt.md", () => ({ default: "Regional forms." }));

vi.mock("./grade-essay.prompt.md", async () => {
  const { readFile } = await import("node:fs/promises");
  const prompt = await readFile(new URL("grade-essay.prompt.md", import.meta.url), "utf8");
  return { default: prompt };
});

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const evidence = {
  awards: [],
  criteria: [],
  elements: [],
  errors: [],
  limits: [],
  nextStep: null,
  onTopicQuote: null,
  zeroKind: null,
  zeroQuote: null,
  zeroRuleIndex: null,
};

const sheet = {
  conventions: ["A source named without a reason earns nothing."],
  criteria: [{ id: "argument", text: "Argument" }],
  limits: [{ criteria: ["argument"], max: 2, text: "A conditional proposal earns at most 2." }],
  rows: [
    {
      awards: [
        { points: 0, text: "No argument." },
        { count: 2, points: 4, text: "A developed argument with two reasons." },
      ],
      criterionId: "argument",
      text: "Argument",
    },
  ],
  zeroing: [{ kinds: ["offTopic"], text: "An answer on another subject." }],
};

describe(gradeWritingEvidence, () => {
  it("grades every sheet with one prompt and sends the sheet's rows as numbered data", async () => {
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult(evidence));

    const input = {
      context: null,
      keyPoints: [],
      language: "pt",
      question: "Escreva sobre o tema.",
      text: "O tema é relevante.",
    };

    const grade = await gradeWritingEvidence({ ...input, ...sheet });

    const unpointed = await gradeWritingEvidence({
      ...input,
      conventions: [],
      criteria: sheet.criteria,
      limits: [],
      rows: [],
      zeroing: [],
    });

    expect(unpointed.systemPrompt).toBe(grade.systemPrompt);
    expect(getWritingGrader().promptVersion).toBe(grade.provenance?.promptVersion);
    expect(grade.systemPrompt).not.toContain("{{");
    expect(grade.userPrompt).toContain("O tema é relevante.");
    expect(grade.userPrompt).toContain('"row":0');
    expect(grade.userPrompt).toContain('"award":1,"count":2,"points":4');
    expect(grade.userPrompt).toContain("A conditional proposal earns at most 2.");
    expect(grade.userPrompt).toContain("A source named without a reason earns nothing.");

    const output = vi.mocked(generateText).mock.lastCall?.[0].output;
    const format = await output?.responseFormat;

    expect(format).toMatchObject({
      schema: {
        properties: {
          awards: { type: "array" },
          elements: { type: "array" },
          limits: { type: "array" },
          zeroQuote: { description: expect.stringContaining("exact passage") },
        },
      },
      type: "json",
    });
  });
});
