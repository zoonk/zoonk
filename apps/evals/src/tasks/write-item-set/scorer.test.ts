import { type WrittenItemSet } from "@zoonk/ai/tasks/items/write-set";
import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { WRITE_LISTENING_SET_SCORE_CATEGORIES } from "../write-listening-set/score-categories";
import { scoreWriteListeningSet } from "../write-listening-set/scorer";
import { WRITE_ITEM_SET_SCORE_CATEGORIES } from "./score-categories";
import { scoreWriteItemSet } from "./scorer";

// The judge is an external model; fail if an all-rejected set reaches it.
vi.mock("ai", () => ({ Output: { object: vi.fn() }, generateText: vi.fn() }));

type Question = Extract<WrittenItemSet["questions"][number], { format: "trueFalse" }>;

function questions(): Question[] {
  return [
    {
      difficulty: "easy",
      evidence: "visits had risen by a third",
      format: "trueFalse",
      isTrue: true,
      misconception: null,
      reason: "Visits rose by a third by December.",
      skill: 1,
      statement: "Opening on Sundays brought more visits to the library.",
    },
    {
      difficulty: "medium",
      evidence: "Weekday visits stayed the same",
      format: "trueFalse",
      isTrue: false,
      misconception: "Assumes visits moved to Sunday",
      reason: "Weekday visits stayed the same, so Sunday added readers.",
      skill: 1,
      statement: "The Sunday visitors were weekday readers who changed days.",
    },
  ];
}

const PASSAGE = `Last year the town library began opening on Sundays, after a vote in which families asked for more time to visit together. The change cost little: two librarians moved a weekday shift to the weekend. By December, visits had risen by a third, and most new visitors came with children. Weekday visits stayed the same, so the Sunday hours added readers instead of moving them. The council now wants to try the same idea at the sports centre, although its staff warn that a pool needs lifeguards, who are harder to find than librarians.`;

function itemOutput(items: WrittenItemSet["questions"]): string {
  return JSON.stringify({
    kind: "text",
    questions: items,
    text: PASSAGE,
    title: "Sunday hours",
    visual: null,
  });
}

function listeningOutput(items: WrittenItemSet["questions"]): string {
  return JSON.stringify({
    set: {
      questions: items.map((question) => ({ ...question, context: null })),
      speakers: [{ accent: "American English", gender: "female", name: "Librarian" }],
      title: "Sunday hours",
      turns: [{ speaker: "Librarian", text: PASSAGE }],
    },
  });
}

describe.each([
  {
    categories: WRITE_ITEM_SET_SCORE_CATEGORIES,
    name: "item-set writer",
    output: itemOutput,
    scorer: scoreWriteItemSet,
  },
  {
    categories: WRITE_LISTENING_SET_SCORE_CATEGORIES,
    name: "listening-set writer",
    output: listeningOutput,
    scorer: scoreWriteListeningSet,
  },
])("$name", ({ categories, output, scorer }) => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();

    vi.mocked(generateText).mockResolvedValue({
      output: {
        categoryScores: categories.map(({ id }) => ({
          categoryId: id,
          reasoning: "Fits the rubric.",
          score: 8,
        })),
        steps: [],
      },
      usage: { inputTokens: 1, outputTokens: 1 },
    } as Awaited<ReturnType<typeof generateText>>);
  });

  function score(items: Question[]) {
    return scorer({
      output: output(items),
      testCase: {
        expectations: "Write questions about the library's Sunday hours.",
        id: "sunday-hours",
        userInput: {
          count: 2,
          format: "trueFalse",
          formats: ["trueFalse"],
          language: "en",
          scriptLanguage: "en",
          skills: ["Interpret a passage"],
        },
      },
    });
  }

  it("does not judge an empty question list when only the set checks pass", async () => {
    const result = await score(questions().map((question) => ({ ...question, reason: "" })));

    expect(result.score).toBe(6);
    expect(result.steps[0]?.conclusion).toContain("The statement has no reason");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("still judges a passing set with full credit for code checks", async () => {
    const result = await score(questions());

    expect(generateText).toHaveBeenCalledOnce();

    expect(result.categoryScores?.at(-1)).toMatchObject({
      categoryId: "codeChecks",
      score: 10,
      weight: 30,
    });
  });

  it("judges the surviving question and counts the rejected question", async () => {
    const [first, second] = questions();
    const result = await score([{ ...first!, reason: "" }, second!]);

    expect(generateText).toHaveBeenCalledOnce();
    expect(vi.mocked(generateText).mock.calls[0]?.[0].prompt).toContain(second!.statement);
    expect(vi.mocked(generateText).mock.calls[0]?.[0].prompt).not.toContain(first!.statement);

    expect(result.categoryScores?.at(-1)).toMatchObject({
      categoryId: "codeChecks",
      score: 7,
      weight: 30,
    });
  });
});
