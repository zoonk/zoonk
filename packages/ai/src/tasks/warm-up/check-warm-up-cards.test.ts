import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { checkWarmUpCards } from "./check-warm-up-cards";
import { type WarmUpCard } from "./warm-up-cards";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./check-warm-up-cards.prompt.md", () => ({ default: "Check the cards." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

function card(id: string): WarmUpCard {
  return {
    id,
    options: [
      { correct: true, id: "a", text: "Five" },
      { correct: false, id: "b", text: "Two" },
    ],
    question: `Question ${id}?`,
    reveal: `Reveal ${id}.`,
  };
}

const params = {
  cards: [card("1"), card("2"), card("3"), card("4")],
  goal: "Beekeeping",
  kind: "learn" as const,
  language: "en",
  writerModel: "openai/gpt-6-luna",
};

describe(checkWarmUpCards, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns one verdict per card in order, dropping cards the checker skipped or doubted", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        verdicts: [
          { id: "2", keep: false, problem: "Two options are right." },
          { id: "1", keep: true, problem: null },
          { id: "4", keep: true, problem: null },
          { id: "4", keep: false, problem: "The reveal contradicts the answer." },
          { id: "9", keep: true, problem: null },
        ],
      }),
    );

    const { data } = await checkWarmUpCards(params);

    expect(data.verdicts).toStrictEqual([
      { id: "1", keep: true, problem: null },
      { id: "2", keep: false, problem: "Two options are right." },
      { id: "3", keep: false, problem: "The checker returned no verdict for this card." },
      { id: "4", keep: false, problem: "The reveal contradicts the answer." },
    ]);
  });

  it("reviews with a model from a family other than the one that wrote the cards", async () => {
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ verdicts: [] }));

    await checkWarmUpCards({ ...params, writerModel: "anthropic/claude-haiku-5.5" });

    expect(vi.mocked(generateText).mock.calls[0]?.[0].model).toBe("google/gemini-3.8-flash");
  });
});
