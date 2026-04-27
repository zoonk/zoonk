import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-activity-data";
import { type ActivityKind } from "@zoonk/core/steps/contract/content";
import { describe, expect, test } from "vitest";
import { type PlayerState } from "./player-reducer";
import { getPlayerScreenModel } from "./player-screen";

function buildStep(overrides: Partial<SerializedStep> = {}): SerializedStep {
  return {
    content: { text: "Hello", title: "Intro", variant: "text" as const },
    fillBlankOptions: [],
    id: "step-1",
    kind: "static",
    matchColumnsRightItems: [],
    position: 0,
    sentence: null,
    sentenceWordOptions: [],
    sortOrderItems: [],
    translationOptions: [],
    vocabularyOptions: [],
    word: null,
    wordBankOptions: [],
    ...overrides,
  };
}

function buildState(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    activityId: "activity-1",
    activityKind: "quiz",
    completion: null,
    currentStepIndex: 0,
    phase: "playing",
    results: {},
    selectedAnswers: {},
    startedAt: 1000,
    stepStartedAt: 1000,
    stepTimings: {},
    steps: [buildStep()],
    totalBrainPower: 0,
    ...overrides,
  };
}

function buildScreen({
  activityKind = "quiz",
  state = buildState(),
}: {
  activityKind?: ActivityKind;
  state?: PlayerState;
} = {}) {
  return getPlayerScreenModel({ ...state, activityKind });
}

describe(getPlayerScreenModel, () => {
  test("uses navigation mode for regular static steps", () => {
    const screen = buildScreen();

    expect(screen.kind).toBe("step");
    expect(screen.bottomBar).toEqual({ canNavigatePrev: false, kind: "navigation" });
    expect(screen.keyboard.enterAction).toBeNull();
    expect(screen.keyboard.rightAction).toBe("navigateNext");
    expect(screen.stageIsStatic).toBe(true);
  });

  test("uses primary action mode for the practice scenario intro", () => {
    const screen = buildScreen({
      activityKind: "practice",
      state: buildState({
        steps: [
          buildStep({ content: { text: "Hello", title: "Intro", variant: "intro" as const } }),
        ],
      }),
    });

    expect(screen.kind).toBe("step");

    expect(screen.bottomBar).toEqual({
      button: "begin",
      disabled: false,
      kind: "primaryAction",
      run: "navigateNext",
    });

    expect(screen.keyboard.enterAction).toBe("navigateNext");
    expect(screen.keyboard.rightAction).toBeNull();
    expect(screen.stageIsFullBleed).toBe(true);
  });

  test("keeps unanswered interactive steps disabled", () => {
    const screen = buildScreen({
      state: buildState({
        steps: [
          buildStep({
            content: {
              kind: "core" as const,
              options: [{ feedback: "Correct", id: "A", isCorrect: true, text: "A" }],
              question: "Choose",
            },
            kind: "multipleChoice",
          }),
        ],
      }),
    });

    expect(screen.kind).toBe("step");
    expect(screen.bottomBar).toEqual({
      button: "check",
      disabled: true,
      kind: "primaryAction",
      run: "check",
    });
    expect(screen.keyboard.enterAction).toBeNull();
  });

  test("keeps completed state in completion mode", () => {
    const screen = buildScreen({ state: buildState({ phase: "completed" }) });

    expect(screen.kind).toBe("completed");
    expect(screen.bottomBar).toBeNull();
    expect(screen.keyboard.enterAction).toBe("nextOrEscape");
    expect(screen.keyboard.canRestart).toBe(true);
  });
});
