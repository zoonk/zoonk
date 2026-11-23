import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { gradeWritingEvidence } from "./grade-essay";
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
  aspects: [],
  criteria: [],
  errors: [],
  nextStep: null,
  onTopicQuote: null,
  zeroKind: null,
  zeroQuote: null,
  zeroRuleIndex: null,
};

describe(gradeWritingEvidence, () => {
  it.each([
    { heading: "The ENEM redação", kind: "enem" },
    { heading: "The OAB legal brief and questions", kind: "oab" },
    { heading: "Points", kind: "points" },
    { heading: "No points", kind: "levels" },
  ] as const)("selects the $kind instructions and evidence fields", async ({ heading, kind }) => {
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult(evidence));

    const grade = await gradeWritingEvidence({
      aspects: [],
      context: null,
      keyPoints: [],
      language: "pt",
      question: "Escreva sobre o tema.",
      scoringBasis: { kind },
      text: "O tema é relevante.",
    });

    expect(grade.systemPrompt).toContain(`# ${heading}`);
    expect(grade.systemPrompt).not.toContain("For the structured response");
    expect(grade.userPrompt).toContain("O tema é relevante.");

    const output = vi.mocked(generateText).mock.lastCall?.[0].output;
    const format = await output?.responseFormat;

    expect(format).toMatchObject({
      schema: {
        properties: { zeroQuote: { description: expect.stringContaining("exact passage") } },
      },
      type: "json",
    });

    const properties = format?.type === "json" ? format.schema?.properties : {};
    expect(Object.hasOwn(properties ?? {}, "interventionElements")).toBe(kind === "enem");
  });
});
