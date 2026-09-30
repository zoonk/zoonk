import { describe, expect, it } from "vitest";
import { checkStep, explanationStep, stepResult } from "../_test-utils/lesson-steps";
import { lessonPlayerReducer } from "../lesson-player-reducer";
import { type LessonPlayerAction, createInitialState } from "../lesson-player-state";
import { getAbandonEvent } from "./lesson-abandon";

const STEPS = [checkStep("q1"), explanationStep("idea"), checkStep("q2"), checkStep("q3")];

const STARTED: LessonPlayerAction = {
  hyperdrive: { knownStepIds: [], streak: 0 },
  runId: "run",
  type: "runStarted",
};

function answer(stepId: string, isCorrect: boolean): LessonPlayerAction[] {
  return [
    {
      answer: { kind: "check", optionId: isCorrect ? "right" : "wrong" },
      stepId,
      type: "selectAnswer",
    },
    { counts: true, result: stepResult(isCorrect), stepId, type: "checkResolved" },
  ];
}

function play(actions: LessonPlayerAction[]) {
  return actions.reduce(
    (state, action) => lessonPlayerReducer(state, action),
    createInitialState({ id: "lesson", steps: STEPS }),
  );
}

describe(getAbandonEvent, () => {
  it("names the screen left and the wrong answers in a row before it, reading screens aside", () => {
    const state = play([
      STARTED,
      ...answer("q1", false),
      { type: "continue" },
      { type: "continue" },
      ...answer("q2", false),
      { type: "continue" },
      ...answer("q3", false),
    ]);

    expect(getAbandonEvent(state)).toStrictEqual({
      name: "Activity Abandoned",
      properties: { lesson_id: "lesson", screen: 4, step_kind: "check", wrong_in_a_row: 3 },
    });
  });

  it("starts counting again after a right answer", () => {
    const state = play([
      STARTED,
      ...answer("q1", false),
      { type: "continue" },
      { type: "continue" },
      ...answer("q2", true),
      { type: "continue" },
      ...answer("q3", false),
    ]);

    expect(getAbandonEvent(state)?.properties).toMatchObject({ wrong_in_a_row: 1 });
  });

  it("counts nothing before the run starts", () => {
    expect(getAbandonEvent(play(answer("q1", false)))).toBeNull();
  });
});
