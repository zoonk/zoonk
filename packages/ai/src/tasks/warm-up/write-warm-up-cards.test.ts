import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { generateWarmUpCards } from "./write-warm-up-cards";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./write-warm-up-cards.prompt.md", () => ({
  default: "Cards in {{LEARNER_LANGUAGE}}.{{#language}} About {{TARGET_LANGUAGE}}.{{/language}}",
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

describe(generateWarmUpCards, () => {
  beforeEach(() => {
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ cards: [] }));
  });

  it("names the learner's language and the one they learn", async () => {
    const { systemPrompt } = await generateWarmUpCards({
      country: null,
      goal: "Espanhol",
      kind: "language",
      language: "pt",
      targetLanguage: "es",
    });

    expect(systemPrompt).toBe("Cards in Português Brasileiro. About Español de México.");
  });

  it("points at the goal for a language it doesn't know yet", async () => {
    const { systemPrompt } = await generateWarmUpCards({
      country: null,
      goal: "Learn a language",
      kind: "language",
      language: "en",
    });

    expect(systemPrompt).toBe("Cards in US English. About the language GOAL names.");
  });
});
