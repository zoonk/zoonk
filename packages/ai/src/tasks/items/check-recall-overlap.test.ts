import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { checkRecallOverlap, toRecallQuestion } from "./check-recall-overlap";
import { type GeneratedItem } from "./item-schemas";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./check-recall-overlap.prompt.md", () => ({ default: "Find repeats." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const STATEMENT: GeneratedItem = {
  context: "Fábio pediu uma informação a um órgão federal.",
  difficulty: "medium",
  format: "trueFalse",
  image: null,
  isTrue: false,
  misconception: "Thinks consent is needed",
  reason: "The law doesn't ask for it.",
  statement: "A prorrogação depende da concordância de Fábio.",
  visual: null,
};

const CHOICE: GeneratedItem = {
  context: null,
  difficulty: "easy",
  fixedOrder: false,
  format: "multipleChoice",
  image: null,
  options: [
    { isCorrect: false, misconception: "New price", reason: "", text: "20%" },
    { isCorrect: true, misconception: null, reason: "", text: "25%" },
  ],
  question: "A ticket went from $40 to $50. By how much did it rise?",
  visual: null,
};

const skill = { description: "Apply the access to information law.", name: "Access law" };

describe(checkRecallOverlap, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows what a learner reads and its key, never the reasons, for both lists", async () => {
    vi.mocked(generateText).mockResolvedValue(createGenerateTextResult({ checks: [] }));

    const { userPrompt } = await checkRecallOverlap({
      candidates: [STATEMENT, CHOICE],
      earlier: [{ answer: null, question: "Explain the extension rule." }],
      skill,
    });

    expect(userPrompt).toContain("1. Explain the extension rule.\n");

    expect(userPrompt).toContain(
      "1. Fábio pediu uma informação a um órgão federal. A prorrogação depende da concordância de Fábio.\n   Answer: false",
    );

    expect(userPrompt).toContain(
      "2. A ticket went from $40 to $50. By how much did it rise? - 20% - 25%\n   Answer: 25%",
    );

    expect(userPrompt).not.toContain("The law doesn't ask for it.");
  });

  it("returns each repeat by its place in both lists, and keeps candidates the model skipped or misnumbered", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        checks: [
          { candidate: 1, reason: "Same case renamed.", repeats: 2 },
          { candidate: 2, reason: "A case of its own.", repeats: null },
          { candidate: 3, reason: "No such candidate.", repeats: 1 },
          { candidate: 2, reason: "No such earlier question.", repeats: 9 },
        ],
      }),
    );

    const { data } = await checkRecallOverlap({
      candidates: [STATEMENT, CHOICE],
      earlier: [toRecallQuestion(CHOICE), toRecallQuestion(STATEMENT)],
      skill,
    });

    expect(data.repeats).toStrictEqual([
      { candidate: 0, earlier: 1, reason: "Same case renamed." },
    ]);
  });
});
