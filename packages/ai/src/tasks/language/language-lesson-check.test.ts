import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { checkLanguageLesson } from "./language-lesson-check";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./language-lesson-check.prompt.md", () => ({ default: "Find errors." }));
vi.mock("./language-lesson.prompt.md", () => ({ default: "Write a lesson." }));
vi.mock("./language-lesson-fix.prompt.md", () => ({ default: "Fix it." }));
vi.mock("./language-lesson-respelling-pt.prompt.md", () => ({ default: "" }));
vi.mock("./language-lesson-respelling-es.prompt.md", () => ({ default: "" }));
vi.mock("./language-lesson-respelling-en.prompt.md", () => ({ default: "" }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

const LESSON = {
  learnerLanguage: "pt",
  lessonDescription: "Diga como estava o tempo.",
  lessonTitle: "O tempo",
  level: "A2",
  screens: [
    { content: { word: "pioveva" }, kind: "vocabulary" },
    { content: { options: [], prompt: "chovia" }, kind: "translation" },
  ],
  targetLanguage: "it",
  unitCanDos: ["Falar do tempo"],
  unitTitle: "O tempo",
};

describe(checkLanguageLesson, () => {
  beforeEach(() => {
    vi.clearAllMocks();

    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({
        issues: [
          { fix: "Write “grandinava”.", problem: "“grand inava” isn't a word.", screen: 2 },
          { fix: "Fix it.", problem: "No such screen.", screen: 9 },
        ],
      }),
    );
  });

  it("has a lesson OpenAI wrote reviewed by another family, and numbers its screens from 0", async () => {
    const { data } = await checkLanguageLesson({ ...LESSON, writerModel: "openai/gpt-6.1-terra" });

    expect(vi.mocked(generateText).mock.calls[0]?.[0]).toMatchObject({
      model: "anthropic/claude-sonnet-5.5",
    });

    expect(data.issues.map((issue) => issue.screen)).toStrictEqual([1, null]);
  });
});
