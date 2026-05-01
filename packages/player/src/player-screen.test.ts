import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type LessonKind } from "@zoonk/core/steps/contract/content";
import { describe, expect, it } from "vitest";
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
    completion: null,
    currentStepIndex: 0,
    lessonId: "lesson-1",
    lessonKind: "quiz",
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
  lessonKind = "quiz",
  state = buildState(),
}: { lessonKind?: LessonKind; state?: PlayerState } = {}) {
  return getPlayerScreenModel({ ...state, lessonKind });
}

describe(getPlayerScreenModel, () => {
  it("uses navigation mode for regular static steps", () => {
    const screen = buildScreen();

    expect(screen.kind).toBe("step");
    expect(screen.bottomBar).toStrictEqual({ canNavigatePrev: false, kind: "navigation" });
    expect(screen.keyboard.enterAction).toBeNull();
    expect(screen.keyboard.rightAction).toBe("navigateNext");
    expect(screen.stageIsStatic).toBe(true);
  });

  it("uses primary action mode for the practice scenario intro", () => {
    const screen = buildScreen({
      lessonKind: "practice",
      state: buildState({
        steps: [
          buildStep({ content: { text: "Hello", title: "Intro", variant: "intro" as const } }),
        ],
      }),
    });

    expect(screen.kind).toBe("step");

    expect(screen.bottomBar).toStrictEqual({
      button: "begin",
      disabled: false,
      kind: "primaryAction",
      run: "navigateNext",
    });

    expect(screen.keyboard.enterAction).toBe("navigateNext");
    expect(screen.keyboard.rightAction).toBeNull();
    expect(screen.stageIsFullBleed).toBe(true);
  });

  it("keeps unanswered interactive steps disabled", () => {
    const screen = buildScreen({
      state: buildState({
        steps: [
          buildStep({
            content: {
              options: [{ feedback: "Correct", id: "A", isCorrect: true, text: "A" }],
              question: "Choose",
            },
            kind: "multipleChoice",
          }),
        ],
      }),
    });

    expect(screen.kind).toBe("step");

    expect(screen.bottomBar).toStrictEqual({
      button: "check",
      disabled: true,
      kind: "primaryAction",
      run: "check",
    });

    expect(screen.keyboard.enterAction).toBeNull();
  });

  it("keeps completed state in completion mode", () => {
    const screen = buildScreen({ state: buildState({ phase: "completed" }) });

    expect(screen.kind).toBe("completed");
    expect(screen.bottomBar).toBeNull();
    expect(screen.keyboard.enterAction).toBe("nextOrEscape");
    expect(screen.keyboard.canRestart).toBe(true);
  });
});
