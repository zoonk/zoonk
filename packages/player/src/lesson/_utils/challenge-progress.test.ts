import { describe, expect, it } from "vitest";
import { challengeStep } from "../_test-utils/lesson-steps";
import { lessonPlayerReducer } from "../lesson-player-reducer";
import { getLessonScreen } from "../lesson-player-screen";
import { type LessonPlayerAction, createInitialState } from "../lesson-player-state";
import { getChallengeProgress, pickChallengeChoice } from "./challenge-progress";

const step = challengeStep("case");

function play(actions: LessonPlayerAction[]) {
  return actions.reduce(
    (state, action) => lessonPlayerReducer(state, action),
    createInitialState({ id: "lesson", steps: [step] }),
  );
}

function pick(choiceIds: string[]): LessonPlayerAction {
  return { answer: { choiceIds, kind: "challenge" }, stepId: "case", type: "selectAnswer" };
}

function primaryOf(actions: LessonPlayerAction[]) {
  const { action, disabled, label } = getLessonScreen(play(actions)).primary ?? {};
  return { action, disabled, label };
}

describe(getChallengeProgress, () => {
  it("shows the intro, then the decision on screen with the pick waiting for Confirm", () => {
    expect(getChallengeProgress({ answer: undefined, shown: 0, step })).toStrictEqual({
      stage: "intro",
    });

    const deciding = getChallengeProgress({
      answer: { choiceIds: ["ask"], kind: "challenge" },
      shown: 1,
      step,
    });

    expect(deciding.stage === "deciding" && deciding.pendingChoiceId).toBe("ask");
    expect(deciding.stage === "deciding" && deciding.walk.node.id).toBe("start");
  });

  it("ends when the confirmed picks reach an ending", () => {
    const ended = getChallengeProgress({
      answer: { choiceIds: ["ask", "ship"], kind: "challenge" },
      shown: 3,
      step,
    });

    expect(ended.stage === "ended" && ended.walk.ending.id).toBe("shipped");
  });

  it("ignores a pick that isn't on the decision in view", () => {
    const deciding = getChallengeProgress({
      answer: { choiceIds: ["ship"], kind: "challenge" },
      shown: 1,
      step,
    });

    expect(deciding.stage === "deciding" && deciding.pendingChoiceId).toBeNull();
  });
});

describe(pickChallengeChoice, () => {
  it("adds the pick after the confirmed ones, or clears it", () => {
    expect(pickChallengeChoice({ choiceId: "ship", confirmed: ["ask"] })).toStrictEqual({
      choiceIds: ["ask", "ship"],
      kind: "challenge",
    });

    expect(pickChallengeChoice({ choiceId: null, confirmed: [] })).toBeNull();
  });
});

describe("a challenge in the lesson player", () => {
  it("starts, confirms one decision at a time and checks the finished path", () => {
    const start = { type: "continue" } as const;

    expect(primaryOf([])).toStrictEqual({ action: "continue", disabled: false, label: "start" });

    expect(primaryOf([start])).toStrictEqual({
      action: "continue",
      disabled: true,
      label: "confirm",
    });

    expect(primaryOf([start, pick(["ask"])])).toStrictEqual({
      action: "continue",
      disabled: false,
      label: "confirm",
    });

    const finished: LessonPlayerAction[] = [
      start,
      pick(["ask"]),
      start,
      pick(["ask", "ship"]),
      start,
    ];

    expect(play(finished).revealed).toStrictEqual({ case: 3 });

    expect(primaryOf(finished)).toStrictEqual({
      action: "check",
      disabled: false,
      label: "seeHowItWent",
    });
  });

  it("doesn't move on without a pick", () => {
    const state = play([{ type: "continue" }, { type: "continue" }]);

    expect(state.revealed).toStrictEqual({ case: 1 });
    expect(state.phase).toBe("playing");
  });
});
