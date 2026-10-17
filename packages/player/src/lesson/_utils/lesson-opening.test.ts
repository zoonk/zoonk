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

/** This sitting started now; answers in these tests were given in it. */
const STARTED_AT = "2026-10-05T10:00:00.000Z";
const ANSWERED_AT = "2026-10-05T10:01:00.000Z";

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

  it("keeps a lesson that opens with a question for a new skill, since what follows builds on it", () => {
    expect(order(questionLesson, "explanationFirst")).toStrictEqual(ids(questionLesson));
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

  it("opens the same way when a run resumes, with 'Explain first' still on the question", () => {
    const lesson = [
      hookGuessStep("hook"),
      withSkill(explanationStep("idea"), "skill-a"),
      withSkill(workedExampleStep("example"), "skill-a"),
      withSkill(checkStep("check"), "skill-a"),
      withSkill(explanationStep("next"), "skill-b"),
    ];

    const start = createInitialState({ id: "lesson", steps: lesson }, "questionFirst");

    const resumed = lessonPlayerReducer(start, {
      answers: [{ answeredAt: ANSWERED_AT, isCorrect: true, stepId: "missing" }],
      hyperdrive: { knownStepIds: [], streak: 0 },
      runId: "run",
      startedAt: STARTED_AT,
      type: "runStarted",
    });

    expect(resumed.queue).toStrictEqual(start.queue);

    const atCheck = lessonPlayerReducer({ ...resumed, position: 1 }, { type: "explainFirst" });

    expect(atCheck.queue).toStrictEqual(["hook", "idea", "example", "check", "next"]);
  });
});
