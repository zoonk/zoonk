import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import {
  type AlphabetLessonContent,
  type PublishedAlphabetLesson,
  fixAlphabetLesson,
} from "./alphabet-lesson";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./alphabet-lesson.prompt.md", () => ({ default: "Write the lesson.\n" }));
vi.mock("./alphabet-lesson-fix.prompt.md", () => ({ default: "Fix the lesson.\n" }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

function letter(symbol: string, pronunciation: string) {
  return { audioText: `${symbol}a`, forms: [], pronunciation, readingAid: symbol, symbol };
}

const published: PublishedAlphabetLesson = {
  canDo: "Read and say four letters.",
  description: "Your first letters.",
  intro: [{ text: "Read left to right.", title: "Direction" }],
  letters: [
    letter("в", "Like v."),
    letter("х", "Like the h in hora."),
    letter("о", "Like o."),
    letter("к", "Like k."),
  ],
  summary: ["Read one letter at a time."],
  title: "First letters",
};

function rewrite(changes: Partial<AlphabetLessonContent>): AlphabetLessonContent {
  return {
    ...published,
    letters: published.letters.map((current) => ({
      ...current,
      ipa: "/x/",
      pronunciation: `${current.pronunciation} Rewritten.`,
    })),
    script: "Cyrillic",
    ...changes,
  };
}

function fix(problems: { problem: string; screen: number | null }[]) {
  return fixAlphabetLesson({
    learnerLanguage: "en",
    lesson: published,
    problems,
    targetLanguage: "ru",
  });
}

describe(fixAlphabetLesson, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("takes only the flagged letter from the fix and keeps every other card as published", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult(rewrite({ summary: ["A new summary."], title: "New title" })),
    );

    const { data, userPrompt } = await fix([{ problem: "The h is silent.", screen: 2 }]);

    expect(userPrompt).toContain("Screen 3: The h is silent.");
    expect(userPrompt).toContain('"screen": 3');

    expect(data).toStrictEqual({
      ...published,
      letters: [
        published.letters[0],
        letter("х", "Like the h in hora. Rewritten."),
        published.letters[2],
        published.letters[3],
      ],
    });
  });

  it("takes the title, description, can-do line and summary only for a problem on the whole lesson", async () => {
    const wholeLesson = {
      canDo: "Read and say в, х, о and к.",
      description: "Four Russian letters.",
      summary: ["A new summary."],
      title: "New title",
    };

    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult(
        rewrite({ ...wholeLesson, intro: [{ text: "Read up to down.", title: "Direction" }] }),
      ),
    );

    const { data } = await fix([{ problem: "The can-do line names no letters.", screen: null }]);

    expect(data).toStrictEqual({ ...published, ...wholeLesson });
  });
});
