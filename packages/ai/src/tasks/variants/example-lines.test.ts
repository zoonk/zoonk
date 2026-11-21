import { generateText } from "ai";
import { describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { generateExampleLines } from "./example-lines";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./example-lines.prompt.md", () => ({
  default: "Example rules.{{#plainWords}} Literal words.{{/plainWords}}",
}));

vi.mock("ai", async (original) => ({ ...(await original<typeof Ai>()), generateText: vi.fn() }));

describe(generateExampleLines, () => {
  it("runs at priority while the learner waits and at flex when written ahead", async () => {
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ lines: [] }));

    const input = {
      country: null,
      facts: ["Cooks dinner for the family"],
      goal: null,
      language: "en",
      learnerHomeCountry: null,
      screens: [{ idea: "Waiting on one task", text: "await pauses only its function." }],
    };

    await generateExampleLines({ ...input, wait: "learner" });
    await generateExampleLines({ ...input, wait: "later" });

    const tiers = vi
      .mocked(generateText)
      .mock.calls.map(([call]) => call.providerOptions?.gateway?.serviceTier);

    expect(tiers.slice(-2)).toStrictEqual(["priority", "flex"]);
  });

  it("keeps plain-words support out of the recorded prompt version", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({ lines: [{ line: "A line.", screen: 1 }] }),
    );

    const input = {
      country: null,
      facts: ["Works as a nurse"],
      goal: null,
      language: "en",
      learnerHomeCountry: null,
      screens: [{ idea: "A discount", text: "25% removes one quarter." }],
      wait: "learner" as const,
    };

    const ordinary = await generateExampleLines(input);
    const personal = await generateExampleLines({ ...input, plainWords: true });
    expect(personal.systemPrompt).not.toBe(ordinary.systemPrompt);
    expect(personal.provenance.promptVersion).toBe(ordinary.provenance.promptVersion);
  });

  it("gives the learner's own money only from where they said they live", async () => {
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ lines: [] }));

    const input = {
      country: null,
      facts: ["Divide o aluguel com duas amigas"],
      goal: null,
      language: "pt",
      screens: [{ idea: "Uma conta dividida", text: "Dividir é repartir em partes iguais." }],
      wait: "learner" as const,
    };

    const lisbon = await generateExampleLines({ ...input, learnerHomeCountry: "PT" });
    const unknown = await generateExampleLines({ ...input, learnerHomeCountry: null });

    expect(lisbon.userPrompt).toContain("HOME_COUNTRY: Portugal, money written 2400,00\u00A0€");
    expect(lisbon.userPrompt).toContain("- Place: Brazil");
    expect(unknown.userPrompt).toContain("HOME_COUNTRY: none");
  });
});
