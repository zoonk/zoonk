import { describe, expect, it } from "vitest";
import {
  checkStep,
  explanationStep,
  stepResult,
  workedExampleStep,
} from "../_test-utils/lesson-steps";
import { lessonPlayerReducer } from "../lesson-player-reducer";
import { type LessonPlayerAction, createInitialState } from "../lesson-player-state";
import { type PlayableLibraryStep } from "../lesson-player-types";
import { getStruggleOffer } from "./lesson-struggle";

function withSkill(step: PlayableLibraryStep, skillId: string): PlayableLibraryStep {
  return { ...step, skillId };
}

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

function play(steps: PlayableLibraryStep[], actions: LessonPlayerAction[]) {
  return actions.reduce(
    (state, action) => lessonPlayerReducer(state, action),
    createInitialState({ hasMap: false, id: "lesson", steps }),
  );
}

const lesson = [
  withSkill(explanationStep("idea"), "skill-a"),
  withSkill(checkStep("first"), "skill-a"),
  withSkill(checkStep("second"), "skill-a"),
  withSkill(explanationStep("other"), "skill-b"),
  withSkill(checkStep("third"), "skill-b"),
];

describe(getStruggleOffer, () => {
  it("offers the idea's explanation right after two misses in a row on it", () => {
    const once = play(lesson, [{ type: "continue" }, ...answer("first", false)]);
    expect(getStruggleOffer(once)).toBeNull();

    const twice = play(lesson, [
      { type: "continue" },
      ...answer("first", false),
      { type: "continue" },
      ...answer("second", false),
    ]);

    expect(getStruggleOffer(twice)?.id).toBe("idea");

    expect(getStruggleOffer(lessonPlayerReducer(twice, { type: "continue" }))).toBeNull();
  });

  it("starts over after a right answer and ignores misses on different ideas", () => {
    const recovered = play(lesson, [
      { type: "continue" },
      ...answer("first", false),
      { type: "continue" },
      ...answer("second", true),
    ]);

    expect(getStruggleOffer(recovered)).toBeNull();

    const differentIdeas = play(lesson, [
      { type: "continue" },
      ...answer("first", true),
      { type: "continue" },
      ...answer("second", false),
      { type: "continue" },
      { type: "continue" },
      ...answer("third", false),
    ]);

    expect(getStruggleOffer(differentIdeas)).toBeNull();
  });

  it("offers the explanation after a question that opens the lesson, and none without one", () => {
    const opensWithQuestion = [
      withSkill(checkStep("try"), "skill-a"),
      withSkill(workedExampleStep("example"), "skill-a"),
    ];

    const missedTwice = play(opensWithQuestion, [
      ...answer("try", false),
      { type: "continue" },
      { type: "continue" },
      { type: "continue" },
      { type: "continue" },
      ...answer("try", false),
    ]);

    expect(getStruggleOffer(missedTwice)?.id).toBe("example");

    const noExplanation = play(
      [checkStep("a"), checkStep("b")],
      [...answer("a", false), { type: "continue" }, ...answer("b", false)],
    );

    expect(getStruggleOffer(noExplanation)).toBeNull();
  });
});
