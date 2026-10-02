import { describe, expect, it } from "vitest";
import {
  checkStep,
  explanationStep,
  hookGuessStep,
  typedAnswerStep,
  workedExampleStep,
} from "../_test-utils/lesson-steps";
import { lessonPlayerReducer } from "../lesson-player-reducer";
import { createInitialState } from "../lesson-player-state";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { orderLessonOpening } from "./lesson-opening";

function withSkill(step: PlayableLibraryStep, skillId: string): PlayableLibraryStep {
  return { ...step, skillId };
}

function ids(steps: PlayableLibraryStep[]): string[] {
  return steps.map((step) => step.id);
}

function order(steps: PlayableLibraryStep[], support: "explanationFirst" | "questionFirst" | null) {
  return orderLessonOpening({
    queue: steps.map((step) => step.id),
    steps: Object.fromEntries(steps.map((step) => [step.id, step])),
    support,
  });
}

describe(orderLessonOpening, () => {
  const explanationLesson = [
    hookGuessStep("hook"),
    explanationStep("idea"),
    workedExampleStep("example"),
    checkStep("check"),
    explanationStep("next"),
  ];

  const questionLesson = [
    hookGuessStep("hook"),
    checkStep("try"),
    explanationStep("idea"),
    workedExampleStep("example"),
    checkStep("check"),
  ];

  it("opens a partly known skill with the question after its explanations, keeping the hook first", () => {
    expect(order(explanationLesson, "questionFirst")).toStrictEqual([
      "hook",
      "check",
      "idea",
      "example",
      "next",
    ]);
  });

  it("opens a new skill with the explanations a question-first lesson puts after its question", () => {
    expect(order(questionLesson, "explanationFirst")).toStrictEqual([
      "hook",
      "idea",
      "example",
      "try",
      "check",
    ]);
  });

  it("keeps a lesson that already opens the right way, and any lesson without a learner order", () => {
    expect(order(explanationLesson, "explanationFirst")).toStrictEqual(ids(explanationLesson));
    expect(order(questionLesson, "questionFirst")).toStrictEqual(ids(questionLesson));
    expect(order(explanationLesson, null)).toStrictEqual(ids(explanationLesson));
  });

  it("never brings forward a question about another skill or one that isn't a check", () => {
    const otherSkill = [
      hookGuessStep("hook"),
      withSkill(explanationStep("idea"), "skill-a"),
      withSkill(checkStep("check"), "skill-b"),
    ];

    const typedNext = [hookGuessStep("hook"), explanationStep("idea"), typedAnswerStep("typed")];

    expect(order(otherSkill, "questionFirst")).toStrictEqual(["hook", "idea", "check"]);
    expect(order(typedNext, "questionFirst")).toStrictEqual(["hook", "idea", "typed"]);
  });

  it("opens the same way after starting over, with 'Explain first' still on the question", () => {
    const lesson = [
      hookGuessStep("hook"),
      withSkill(explanationStep("idea"), "skill-a"),
      withSkill(workedExampleStep("example"), "skill-a"),
      withSkill(checkStep("check"), "skill-a"),
      withSkill(explanationStep("next"), "skill-b"),
    ];

    const start = createInitialState({ id: "lesson", steps: lesson }, "questionFirst");
    const restarted = lessonPlayerReducer(start, { type: "restart" });

    expect(restarted.queue).toStrictEqual(start.queue);

    const atCheck = lessonPlayerReducer({ ...restarted, position: 1 }, { type: "explainFirst" });

    expect(atCheck.queue).toStrictEqual(["hook", "idea", "example", "check", "next"]);
  });
});
