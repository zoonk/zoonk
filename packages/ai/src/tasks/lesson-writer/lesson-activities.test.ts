import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGenerateTextResult } from "../_test-utils/generate-text-result";
import { type LessonSpec } from "../lesson-spec/lesson-spec-rules";
import { writeLessonActivities } from "./lesson-activities";
import type * as Ai from "ai";

vi.mock("server-only", () => ({}));

vi.mock("ai", async (importOriginal) => {
  const actual = await importOriginal<typeof Ai>();
  return { ...actual, generateText: vi.fn() };
});

function spec(): LessonSpec {
  return {
    canDo: "Print two lines",
    description: "Statements run in order.",
    estimatedMinutes: 3,
    screens: [
      {
        activityTemplate: null,
        brief: "Two prints.",
        kind: "workedExample",
        skills: [0],
        visual: null,
        visualKind: "none",
      },
      {
        activityTemplate: "codeRunner",
        brief: "Fix line 2 so it prints Thanks.",
        kind: "activity",
        skills: [0],
        visual: null,
        visualKind: "template",
      },
    ],
    skills: [
      {
        description: "Write print statements.",
        example: "print('Hi')",
        hard: true,
        name: "Print statements",
        topic: "Python",
        useCase: "A receipt.",
      },
    ],
    title: "Python statements",
  };
}

function write(problems?: Parameters<typeof writeLessonActivities>[0]["problems"]) {
  return writeLessonActivities({
    activityTemplates: [{ description: "Run and fix real code.", id: "codeRunner", schema: "{}" }],
    chapterTitle: "Basics",
    country: null,
    courseTitle: "Python",
    indexes: [1],
    language: "en",
    level: "beginner",
    problems,
    screens: [
      { content: { problem: "Print two lines." }, kind: "workedExample" },
      { content: { question: "What prints?" }, kind: "check" },
    ],
    spec: spec(),
  });
}

describe(writeLessonActivities, () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns only the screens it was asked for, with the template the plan names", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(
      createGenerateTextResult({
        screens: [
          { content: "{}", kind: "activity", screen: 2, template: "categorize" },
          { content: "{}", kind: "activity", screen: 1, template: "codeRunner" },
        ],
      }),
    );

    const { data, systemPrompt, userPrompt } = await write();

    expect(data).toStrictEqual([
      { index: 1, screen: { content: "{}", kind: "activity", template: "codeRunner" } },
    ]);

    expect(systemPrompt).toContain("A `codeRunner` or `sqlPlayground` activity has the learner");
    expect(systemPrompt).toContain("Write the way you'd say it out loud");
    expect(systemPrompt).not.toMatch(/\{\{[A-Z_#/]/u);
    expect(userPrompt).toContain("2. activity, written as: activity");
    expect(userPrompt).toContain("SCREENS_TO_WRITE: 2");
    expect(userPrompt).not.toContain("EARLIER_TRY");
  });

  it("tells a second try what held the first one back", async () => {
    vi.mocked(generateText).mockResolvedValueOnce(createGenerateTextResult({ screens: [] }));

    const { data, userPrompt } = await write([
      { problem: "The solution prints 3.", screen: 1, source: "check" },
    ]);

    expect(data).toStrictEqual([]);
    expect(userPrompt).toContain("EARLIER_TRY:");
    expect(userPrompt).toContain("- Screen 2 (automatic check): The solution prints 3.");
  });
});
