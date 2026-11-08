import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { type SolvableItem, solveItems } from "./solve-items";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./solve-items.prompt.md", () => ({ default: "Solve the questions." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const CHOICE: SolvableItem = {
  context: "A bill splits R$ 90,00 among 3 friends.",
  difficulty: "hard",
  fixedOrder: false,
  format: "multipleChoice",
  image: null,
  options: [
    {
      isCorrect: false,
      misconception: "Divides by 2",
      reason: "Halving gives 45.",
      text: "R$ 45,00",
    },
    { isCorrect: true, misconception: null, reason: "Ninety over three.", text: "R$ 30,00" },
  ],
  question: "How much does each friend pay?",
  visual: null,
};

const STATEMENT: SolvableItem = {
  context: null,
  difficulty: "easy",
  format: "trueFalse",
  image: { alt: "A sign", prompt: "A sign reading 'Closed on Sundays'." },
  isTrue: false,
  misconception: "Ignores the sign",
  reason: "The sign says it closes.",
  statement: "The shop opens on Sundays.",
  visual: null,
};

describe(solveItems, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows what the learner sees, never the key, and returns each answer in its item's place", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        answers: [
          { answer: ["undecidable"], item: 2, work: "The sign could be old." },
          { answer: ["B", "B"], item: 1, work: "90 ÷ 3 = 30." },
        ],
      }),
    );

    const { data, userPrompt } = await solveItems({
      items: [CHOICE, STATEMENT, { ...STATEMENT, statement: "Skipped." }],
    });

    expect(userPrompt).toContain("How much does each friend pay?");
    expect(userPrompt).toContain("Closed on Sundays");

    for (const hidden of ["isCorrect", "Ninety over three", "Divides by 2", "difficulty", "hard"]) {
      expect(userPrompt).not.toContain(hidden);
    }

    expect(data.solutions).toStrictEqual([
      { format: "multipleChoice", picks: [1], work: "90 ÷ 3 = 30." },
      { format: "trueFalse", isTrue: null, work: "The sign could be old." },
      null,
    ]);
  });

  it.each([
    { answer: ["none"], picks: [] },
    { answer: ["A", "none"], picks: [] },
    { answer: ["A", "B"], picks: [0, 1] },
  ] as const)("reads $answer as the picks $picks", async ({ answer, picks }) => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({ answers: [{ answer, item: 1, work: "" }] }),
    );

    const { data } = await solveItems({ items: [CHOICE] });

    expect(data.solutions).toStrictEqual([{ format: "multipleChoice", picks, work: "" }]);
  });
});
