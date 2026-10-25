import { describe, expect, it } from "vitest";
import {
  checkStep,
  explanationStep,
  stepResult,
  typedAnswerStep,
} from "../_test-utils/lesson-steps";
import { lessonPlayerReducer } from "../lesson-player-reducer";
import { type LessonPlayerAction, createInitialState } from "../lesson-player-state";
import { getAbandonEvent } from "./lesson-abandon";

/** When the run in these tests started. */
const STARTED_AT = "2026-10-05T10:00:00.000Z";

const STEPS = [checkStep("q1"), explanationStep("idea"), checkStep("q2"), checkStep("q3")];

const STARTED: LessonPlayerAction = {
  answers: [],
  hyperdrive: { knownStepIds: [], streak: 0 },
  runId: "run",
  startedAt: STARTED_AT,
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

function play(actions: LessonPlayerAction[], steps = STEPS) {
  return actions.reduce(
    (state, action) => lessonPlayerReducer(state, action),
    createInitialState({ id: "lesson", steps }),
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

  it("leaves out an answer without a verdict, such as a sample answer read", () => {
    const state = play(
      [
        STARTED,
        ...answer("q1", false),
        { type: "continue" },
        { stepId: "write", type: "skipWriting" },
        { type: "continue" },
      ],
      [checkStep("q1"), typedAnswerStep("write"), checkStep("q2")],
    );

    expect(getAbandonEvent(state)?.properties).toMatchObject({ screen: 3, wrong_in_a_row: 1 });
  });

  it("counts nothing before the run starts", () => {
    expect(getAbandonEvent(play(answer("q1", false)))).toBeNull();
  });
});
