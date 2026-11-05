import { type LessonScreenKind, type LessonSpec } from "@zoonk/ai/tasks/lesson-spec/rules";
import { generateText } from "ai";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { scoreLessonSpec } from "./scorer";
import { type LessonSpecExpected } from "./visual-test-cases";

// The judge is an external model; keep its response deterministic and prevent paid calls.
vi.mock("ai", () => ({ Output: { object: vi.fn() }, generateText: vi.fn() }));

function lesson(kinds: LessonScreenKind[]): LessonSpec {
  return {
    canDo: "Find the valence electrons of an atom",
    description: "Use the outer shell to identify valence electrons.",
    estimatedMinutes: 4,
    screens: kinds.map((kind) => ({
      activityTemplate: kind === "activity" ? "atom-builder" : null,
      brief: "Find the electrons in the outer shell of a carbon atom.",
      kind,
      skills: kind === "hook" ? [] : [0],
      visual: kind === "hook" ? "A carbon atom with its electron shells labeled." : null,
    })),
    skills: [
      {
        description: "Identify the electrons in the outer shell.",
        example: "Carbon has four valence electrons.",
        hard: false,
        name: "Find valence electrons",
        topic: "Valence electrons",
        useCase: "Predict how atoms bond.",
      },
    ],
    supportMode: "explanationFirst",
    title: "Valence electrons",
  };
}

function passingLesson(): LessonSpec {
  return lesson([
    "hook",
    "explanation",
    "check",
    "explanation",
    "check",
    "activity",
    "application",
  ]);
}

function failingLesson(): LessonSpec {
  return lesson([
    "hook",
    "explanation",
    "explanation",
    "workedExample",
    "explanation",
    "check",
    "activity",
    "application",
  ]);
}

function score(lessons: LessonSpec[], expected?: LessonSpecExpected) {
  return scoreLessonSpec({
    output: JSON.stringify({ lessons }),
    testCase: {
      expectations: "Plan a lesson on identifying valence electrons.",
      expected,
      id: "pt-eletrons-valencia",
      userInput: { level: "beginner" },
    },
  });
}

describe(scoreLessonSpec, () => {
  beforeEach(() => {
    vi.mocked(generateText).mockReset();

    vi.mocked(generateText).mockResolvedValue({
      output: {
        categoryScores: [
          { categoryId: "oneIdea", reasoning: "One idea.", score: 9 },
          { categoryId: "screenPlan", reasoning: "Clear plan.", score: 8 },
          { categoryId: "activitiesAndVisuals", reasoning: "Useful visuals.", score: 7 },
          { categoryId: "levelAndScope", reasoning: "Fits the learner.", score: 10 },
        ],
        steps: [],
      },
      usage: { inputTokens: 1, outputTokens: 1 },
    } as Awaited<ReturnType<typeof generateText>>);
  });

  it.each<{ name: string; expected?: LessonSpecExpected }>([
    { name: "no extra checks" },
    { expected: { pictures: "any" }, name: "pictures not checked" },
    { expected: { pictures: "some" }, name: "passing picture check" },
    { expected: { pictures: "none" }, name: "failing picture check" },
    { expected: { avoidTemplates: ["slider-graph"] }, name: "passing template check" },
    { expected: { avoidTemplates: ["atom-builder"] }, name: "failing template check" },
    {
      expected: { avoidTemplates: ["slider-graph"], pictures: "some" },
      name: "both extra checks passing",
    },
    {
      expected: { avoidTemplates: ["atom-builder"], pictures: "none" },
      name: "both extra checks failing",
    },
  ])("returns the same failure score with $name", async ({ expected }) => {
    const result = await score([failingLesson()], expected);

    expect(result.score).toBe(6);
    expect(result.steps[0]?.conclusion).toContain("4 teaching screens in a row");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("does not judge an empty output even when absence checks pass", async () => {
    const result = await score([], { avoidTemplates: ["atom-builder"], pictures: "none" });

    expect(result.score).toBe(6);
    expect(result.steps[0]?.conclusion).toContain("no valid lesson specs");
    expect(generateText).not.toHaveBeenCalled();
  });

  it("keeps the passing plan's judge input and category weights", async () => {
    const lessons = [passingLesson()];
    const result = await score(lessons, { avoidTemplates: ["slider-graph"], pictures: "some" });

    expect(generateText).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        prompt: expect.stringContaining(JSON.stringify({ lessons }, null, 2)),
      }),
    );

    expect(result.categoryScores?.at(-1)).toMatchObject({
      categoryId: "codeChecks",
      score: 10,
      weight: 30,
    });

    expect(result.score).toBeCloseTo((860 + 10 * 30) / 130);
  });

  it("judges only passing lessons and retains failed lessons in the check ratio", async () => {
    const passing = passingLesson();
    const failing = { ...failingLesson(), title: "Rejected lesson" };

    const result = await score([failing, passing], {
      avoidTemplates: ["slider-graph"],
      pictures: "some",
    });

    expect(generateText).toHaveBeenCalledExactlyOnceWith(
      expect.objectContaining({
        prompt: expect.stringContaining(JSON.stringify({ lessons: [passing] }, null, 2)),
      }),
    );

    expect(vi.mocked(generateText).mock.calls[0]?.[0].prompt).not.toContain("Rejected lesson");

    expect(result.categoryScores?.at(-1)).toMatchObject({
      categoryId: "codeChecks",
      score: 7.75,
      weight: 30,
    });

    expect(result.score).toBeCloseTo((860 + 7.75 * 30) / 130);
  });
});
