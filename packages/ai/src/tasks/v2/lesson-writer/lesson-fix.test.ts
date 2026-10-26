import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { type LessonSpec } from "../lesson-spec/lesson-spec-rules";
import { fixLessonDraft } from "./lesson-fix";
import { type WrittenLesson, type WrittenScreen } from "./written-lesson-schema";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("./lesson-fix.prompt.md", () => ({
  default: [
    "Fix the lesson.",
    "{{#writtenAnswers}}",
    "Fix typed answers.",
    "{{/writtenAnswers}}",
    "Keep the rest.",
  ].join("\n"),
}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

function explanation(text: string): WrittenScreen {
  return {
    exampleLineIdea: null,
    explore: null,
    image: null,
    kind: "explanation",
    text,
    title: text,
    visual: null,
  };
}

function spec(screenCount: number): LessonSpec {
  return {
    canDo: "Do it",
    description: "An idea.",
    estimatedMinutes: 3,
    screens: Array.from({ length: screenCount }, () => ({
      activityTemplate: null,
      brief: "Explain.",
      kind: "explanation" as const,
      skills: [0],
      visual: null,
    })),
    skills: [
      {
        description: "Idea.",
        example: "Example.",
        hard: false,
        name: "Do it",
        topic: "It",
        useCase: "Work.",
      },
    ],
    supportMode: "explanationFirst",
    title: "A lesson",
  };
}

const lesson: WrittenLesson = {
  screens: [explanation("One"), explanation("Two"), explanation("Three")],
  summary: ["The idea."],
};

function fix(params: { screenCount: number; writtenAnswers?: boolean }) {
  return fixLessonDraft({
    activityTemplates: [],
    chapterTitle: "Chapter",
    courseTitle: "Course",
    language: "en",
    lesson,
    level: "beginner",
    problems: [{ problem: "Too long.", screen: 1 }],
    spec: spec(params.screenCount),
    writtenAnswers: params.writtenAnswers,
  });
}

describe(fixLessonDraft, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces only the screens it fixed and keeps the summary when none comes back", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        screens: [
          { content: explanation("Two, shorter"), screen: 2 },
          { content: explanation("Out of the plan"), screen: 9 },
        ],
        summary: null,
      }),
    );

    const { data, userPrompt } = await fix({ screenCount: 3 });

    expect(userPrompt).toContain("Screen 2: Too long.");
    expect(data.changedScreens).toStrictEqual([1]);

    expect(data.lesson).toStrictEqual({
      screens: [explanation("One"), explanation("Two, shorter"), explanation("Three")],
      summary: ["The idea."],
    });
  });

  it("fixes with Luna, falling back to Sol and then Opus", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({ screens: [], summary: null }, "openai/gpt-6-luna"),
    );

    await fix({ screenCount: 3 });

    expect(vi.mocked(generateText).mock.calls[0]?.[0]).toMatchObject({
      model: "openai/gpt-6-luna",
      providerOptions: { gateway: { models: ["openai/gpt-6-sol", "anthropic/claude-opus-5.5"] } },
    });
  });

  it("fills a planned screen the draft left out and takes a new summary", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        screens: [{ content: explanation("Four"), screen: 4 }],
        summary: ["A clearer idea."],
      }),
    );

    const { data } = await fix({ screenCount: 4 });

    expect(data.changedScreens).toStrictEqual([3]);
    expect(data.lesson.screens.at(-1)).toStrictEqual(explanation("Four"));
    expect(data.lesson.summary).toStrictEqual(["A clearer idea."]);
  });

  it("reads the typed answers' rules only for a lesson whose learners' exams ask written answers", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({ screens: [], summary: null }),
    );

    const [picked, written] = await Promise.all([
      fix({ screenCount: 3 }),
      fix({ screenCount: 3, writtenAnswers: true }),
    ]);

    expect(picked.systemPrompt).toBe("Fix the lesson.\nKeep the rest.");
    expect(written.systemPrompt).toBe("Fix the lesson.\nFix typed answers.\nKeep the rest.");
  });
});
