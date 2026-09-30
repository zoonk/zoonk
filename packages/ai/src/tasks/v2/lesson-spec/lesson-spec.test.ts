import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { generateLessonSpec } from "./lesson-spec";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));
vi.mock("./lesson-spec.prompt.md", () => ({ default: "Plan the lesson." }));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

function rawSkill(topic: string) {
  return {
    description: `${topic} idea.`,
    example: `${topic} example`,
    hard: false,
    name: `Find the ${topic.toLowerCase()}`,
    topic,
    useCase: `${topic} at work`,
  };
}

function rawScreen(kind: string, skills: number[], activityTemplate: string | null = null) {
  return { activityTemplate, brief: kind, kind, skills, visual: null };
}

describe(generateLessonSpec, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns specs with skill indexes, catalog-only activities and oversized lessons split", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        lessons: [
          {
            canDo: "Summarize a data set",
            description: "Center and spread.",
            screens: [
              rawScreen("hook", []),
              rawScreen("explanation", [1]),
              rawScreen("activity", [1], "madeUpChart"),
              rawScreen("explanation", [2]),
              rawScreen("activity", [2], "numberLine"),
              rawScreen("explanation", [3]),
              rawScreen("check", [3]),
              rawScreen("explanation", [4]),
              rawScreen("check", [4]),
              rawScreen("application", [1, 2, 3, 4]),
            ],
            skills: ["Mean", "Median", "Mode", "Range"].map((topic) => rawSkill(topic)),
            supportMode: "explanationFirst",
            title: "Summarizing a data set",
          },
        ],
      }),
    );

    const { data } = await generateLessonSpec({
      activityTemplates: [{ description: "Jump along a number line.", id: "numberLine" }],
      chapterTitle: "Describing data",
      courseTitle: "Statistics",
      language: "en",
      lessonDescription: "Center and spread.",
      lessonTitle: "Summarizing a data set",
      level: "beginner",
    });

    expect(data.lessons.map((lesson) => lesson.title)).toStrictEqual([
      "Mean and Median",
      "Mode and Range",
    ]);

    expect(
      data.lessons[0]?.screens.map((screen) => [
        screen.kind,
        screen.skills,
        screen.activityTemplate,
      ]),
    ).toStrictEqual([
      ["hook", [0], null],
      ["explanation", [0], null],
      ["check", [0], null],
      ["explanation", [1], null],
      ["activity", [1], "numberLine"],
      ["application", [0, 1], null],
    ]);
  });
});
