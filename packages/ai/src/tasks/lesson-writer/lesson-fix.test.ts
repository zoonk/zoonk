import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { answerOnceWith } from "../_test-utils/answer-once-with";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { type LessonSpec } from "../lesson-spec/lesson-spec-rules";
import { fixLessonDraft } from "./lesson-fix";
import { type WrittenLesson, type WrittenScreen } from "./written-lesson-schema";
import type * as Ai from "ai";

/** Where the schema the answer follows starts, after the fix's rules. */
const OUTPUT_FORMAT = "\n\n# Output format";

vi.mock("server-only", () => ({}));

vi.mock("./lesson-fix.prompt.md", () => ({
  default: [
    "Fix the lesson.",
    "{{#shortAnswers}}",
    "Fix typed answers.",
    "{{/shortAnswers}}",
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
      visualKind: "none",
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
    title: "A lesson",
  };
}

const lesson: WrittenLesson = {
  screens: [explanation("One"), explanation("Two"), explanation("Three")],
  summary: { ideas: [{ label: "Idea", text: "The idea." }], shape: "hub" },
};

function fix(params: { screenCount: number; shortAnswers?: boolean }) {
  return fixLessonDraft({
    activityTemplates: [],
    chapterTitle: "Chapter",
    courseTitle: "Course",
    language: "en",
    lesson,
    level: "beginner",
    problems: [{ problem: "Too long.", screen: 1 }],
    shortAnswers: params.shortAnswers,
    spec: spec(params.screenCount),
  });
}

/** A fixed check screen 2 with `count` options, the first one right. */
function fixedCheck(count: number) {
  return {
    basis: null,
    context: null,
    image: null,
    kind: "check" as const,
    options: Array.from({ length: count }, (_, index) => ({
      isCorrect: index === 0,
      picture: null,
      reason: `Why ${index}.`,
      text: `Option ${index}`,
    })),
    question: "Which one?",
    screen: 2,
    visual: null,
  };
}

describe(fixLessonDraft, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("replaces only the screens it fixed and keeps the summary when none comes back", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        screens: [
          { ...explanation("Two, shorter"), screen: 2 },
          { ...explanation("Out of the plan"), screen: 9 },
        ],
        summary: null,
      }),
    );

    const { data, userPrompt } = await fix({ screenCount: 3 });

    expect(userPrompt).toContain("Screen 2: Too long.");
    expect(userPrompt).toContain("\nMONEY: $2,400.00 or $2,400\n");
    expect(data.changedScreens).toStrictEqual([1]);

    expect(data.lesson).toStrictEqual({
      screens: [explanation("One"), explanation("Two, shorter"), explanation("Three")],
      summary: lesson.summary,
    });
  });

  it("fixes with Luna, falling back to Haiku and then Terra", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({ screens: [], summary: null }, "openai/gpt-6-luna"),
    );

    await fix({ screenCount: 3 });

    expect(vi.mocked(generateText).mock.calls[0]?.[0]).toMatchObject({
      model: "openai/gpt-6-luna",
      providerOptions: {
        gateway: { models: ["anthropic/claude-haiku-5.5", "openai/gpt-6.1-terra"] },
      },
    });
  });

  it("fills a planned screen the draft left out and takes a new summary, repaired", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        screens: [{ ...explanation("Four"), screen: 4 }],
        summary: {
          ideas: [{ label: "**Clearer** idea.", text: " A clearer idea. " }],
          shape: "nested",
        },
      }),
    );

    const { data } = await fix({ screenCount: 4 });

    expect(data.changedScreens).toStrictEqual([3]);
    expect(data.lesson.screens.at(-1)).toStrictEqual(explanation("Four"));

    expect(data.lesson.summary).toStrictEqual({
      ideas: [{ label: "Clearer idea", text: "A clearer idea." }],
      shape: "hub",
    });
  });

  it("reads the typed answers' rules only for a lesson whose learners' exams ask written answers", async () => {
    vi.mocked(generateText).mockResolvedValue(
      createGenerateTextResult({ screens: [], summary: null }),
    );

    const [picked, written] = await Promise.all([
      fix({ screenCount: 3 }),
      fix({ screenCount: 3, shortAnswers: true }),
    ]);

    expect(picked.systemPrompt.split(OUTPUT_FORMAT)[0]).toBe("Fix the lesson.\nKeep the rest.");

    expect(written.systemPrompt.split(OUTPUT_FORMAT)[0]).toBe(
      "Fix the lesson.\nFix typed answers.\nKeep the rest.",
    );
  });

  it("drops a check's extra wrong option instead of failing the fix", async () => {
    await answerOnceWith({ screens: [fixedCheck(6)], summary: null });

    const { data } = await fix({ screenCount: 3 });
    const { screen: _number, ...fixed } = fixedCheck(5);

    expect(data.lesson.screens[1]).toStrictEqual(fixed);
  });
});
