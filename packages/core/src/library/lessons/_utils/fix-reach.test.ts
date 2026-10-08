import { type WrittenLesson, type WrittenScreen } from "@zoonk/ai/tasks/v2/lesson-writer/schema";
import { describe, expect, it } from "vitest";
import { writtenTemperatureLesson } from "../../quality/_test-utils/written-lessons";
import { type LessonGateProblem } from "../../quality/lesson-quality-gate";
import { getFixReach } from "./fix-reach";

function explanation(text: string): WrittenScreen {
  return {
    exampleLineIdea: null,
    image: null,
    kind: "explanation",
    text,
    title: "Up is up",
    visual: null,
  };
}

/** The draft with new content on the given screens, as a fix pass returns it. */
function rewrite(draft: WrittenLesson, screens: number[]): WrittenLesson {
  return {
    ...draft,
    screens: draft.screens.map((screen, index) =>
      screens.includes(index) ? explanation(`Fixed screen ${index + 1}.`) : structuredClone(screen),
    ),
  };
}

function problem(screen: number | null, source: "code" | "review" = "review"): LessonGateProblem {
  return { problem: "Something to fix.", screen, source };
}

describe(getFixReach, () => {
  it("stays on the flagged screens when the fix only rewrote what a check named", () => {
    const draft = writtenTemperatureLesson();

    expect(
      getFixReach({
        draft,
        fixed: rewrite(draft, [1, 3]),
        incorrect: [problem(3)],
        problems: [problem(1, "code"), problem(3)],
      }),
    ).toStrictEqual({ strayed: false, unfixed: [] });
  });

  it("strays when the fix changed a screen no check named", () => {
    const draft = writtenTemperatureLesson();

    expect(
      getFixReach({
        draft,
        fixed: rewrite(draft, [3, 5]),
        incorrect: [problem(3)],
        problems: [problem(3)],
      }).strayed,
    ).toBe(true);
  });

  it("strays when the fix rewrote the summary card and no problem was about the whole lesson", () => {
    const draft = writtenTemperatureLesson();
    const fixed = { ...rewrite(draft, [3]), summary: ["A rise always ends above zero."] };

    expect(getFixReach({ draft, fixed, incorrect: [], problems: [problem(3)] }).strayed).toBe(true);

    // A problem with no screen is about the whole lesson, such as its summary card.
    expect(getFixReach({ draft, fixed, incorrect: [], problems: [problem(null)] })).toStrictEqual({
      strayed: true,
      unfixed: [],
    });

    expect(
      getFixReach({ draft, fixed, incorrect: [], problems: [problem(3), problem(null)] }),
    ).toStrictEqual({ strayed: false, unfixed: [] });
  });

  it("keeps what the reviewer found wrong on a screen the fix left as it was", () => {
    const draft = writtenTemperatureLesson();
    const wrong = problem(3);

    expect(
      getFixReach({
        draft,
        fixed: rewrite(draft, [1]),
        incorrect: [wrong],
        problems: [problem(1, "code"), wrong],
      }),
    ).toStrictEqual({ strayed: false, unfixed: [wrong] });
  });

  it("keeps a whole-lesson mistake only when the fix changed nothing at all", () => {
    const draft = writtenTemperatureLesson();
    const wrongSummary = problem(null);

    expect(
      getFixReach({
        draft,
        fixed: structuredClone(draft),
        incorrect: [wrongSummary],
        problems: [wrongSummary],
      }),
    ).toStrictEqual({ strayed: false, unfixed: [wrongSummary] });

    expect(
      getFixReach({
        draft,
        fixed: { ...draft, summary: ["A rise moves up, even below zero."] },
        incorrect: [wrongSummary],
        problems: [wrongSummary],
      }).unfixed,
    ).toStrictEqual([]);
  });
});
