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
  it("keeps plain-words support out of the recorded prompt version", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({ lines: [{ line: "A line.", screen: 1 }] }),
    );

    const input = {
      facts: ["Works as a nurse"],
      goal: null,
      language: "en",
      screens: [{ idea: "A discount", text: "25% removes one quarter." }],
    };

    const ordinary = await generateExampleLines(input);
    const personal = await generateExampleLines({ ...input, plainWords: true });
    expect(personal.systemPrompt).not.toBe(ordinary.systemPrompt);
    expect(personal.provenance.promptVersion).toBe(ordinary.provenance.promptVersion);
  });
});
