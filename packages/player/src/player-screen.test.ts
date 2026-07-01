import { type SerializedStep } from "@zoonk/core/player/contracts/prepare-lesson-data";
import { type LessonKind } from "@zoonk/core/steps/contract/content";
import { describe, expect, it } from "vitest";
import { buildSerializedSentence, buildSerializedWord } from "./_test-utils/player-test-data";
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
    completionMilestoneIndex: null,
    currentStepIndex: 0,
    lessonId: "lesson-1",
    lessonKind: "quiz",
    localDate: "2026-06-05",
    phase: "playing",
    progressSnapshot: null,
    results: {},
    selectedAnswers: {},
    shownCompletionMilestoneKeys: [],
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

    expect(screen.bottomBar).toStrictEqual({
      audioUrl: null,
      canNavigatePrev: false,
      kind: "navigation",
    });

    expect(screen.keyboard.enterAction).toBeNull();
    expect(screen.keyboard.rightAction).toBe("navigateNext");
    expect(screen.stageIsStatic).toBe(true);
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
      audioUrl: null,
      button: "check",
      disabled: true,
      kind: "primaryAction",
      run: "check",
    });

    expect(screen.keyboard.enterAction).toBeNull();
  });

  it("uses the start warning screen before unauthenticated lessons begin", () => {
    const screen = buildScreen({ state: buildState({ phase: "startWarning" }) });

    expect(screen.kind).toBe("startWarning");
    expect(screen.scene).toBe("startWarning");
    expect(screen.bottomBar).toBeNull();
    expect(screen.showChrome).toBe(false);

    expect(screen.keyboard).toStrictEqual({
      canRestart: false,
      enterAction: null,
      leftAction: null,
      rightAction: null,
    });
  });

  it("keeps completed state in completion mode", () => {
    const screen = buildScreen({ state: buildState({ phase: "completed" }) });

    expect(screen.kind).toBe("completed");
    expect(screen.scene).toBe("completion");
    expect(screen.bottomBar).toBeNull();
    expect(screen.keyboard.enterAction).toBe("nextOrEscape");
    expect(screen.keyboard.canRestart).toBe(true);
  });

  it("uses continue keyboard behavior for active completion milestones", () => {
    const screen = buildScreen({
      state: buildState({
        completion: {
          belt: {
            bpPerLevel: 250,
            bpToNextLevel: 250,
            color: "white",
            isMaxLevel: false,
            level: 2,
            progressInLevel: 0,
          },
          brainPower: 10,
          correctCount: 1,
          energyDelta: 0.2,
          incorrectCount: 0,
          newTotalBp: 250,
        },
        completionMilestoneIndex: 0,
        phase: "completed",
        totalBrainPower: 240,
      }),
    });

    expect(screen.kind).toBe("completed");
    expect(screen.scene).toBe("completionMilestone");
    expect(screen.keyboard.enterAction).toBe("continue");
    expect(screen.keyboard.canRestart).toBe(false);
  });

  it("adds bottom audio to vocabulary, alphabet, and listening prompt steps", () => {
    const vocabularyScreen = buildScreen({
      state: buildState({
        steps: [
          buildStep({
            content: {},
            kind: "vocabulary",
            word: buildSerializedWord({ audioUrl: "https://example.com/vocabulary.mp3" }),
          }),
        ],
      }),
    });

    const alphabetScreen = buildScreen({
      state: buildState({
        steps: [
          buildStep({
            content: {
              audioText: "あ",
              audioUrl: "https://example.com/alphabet.mp3",
              forms: [],
              pronunciation: "like a in father",
              readingAid: "a",
              symbol: "あ",
            },
            kind: "alphabet",
          }),
        ],
      }),
    });

    const listeningScreen = buildScreen({
      state: buildState({
        steps: [
          buildStep({
            content: {},
            kind: "listening",
            sentence: buildSerializedSentence({ audioUrl: "https://example.com/listening.mp3" }),
          }),
        ],
      }),
    });

    expect(vocabularyScreen.kind).toBe("step");

    expect(vocabularyScreen.bottomBar).toMatchObject({
      audioUrl: "https://example.com/vocabulary.mp3",
      kind: "navigation",
    });

    expect(alphabetScreen.kind).toBe("step");

    expect(alphabetScreen.bottomBar).toMatchObject({
      audioUrl: "https://example.com/alphabet.mp3",
      kind: "navigation",
    });

    expect(listeningScreen.kind).toBe("step");

    expect(listeningScreen.bottomBar).toMatchObject({
      audioUrl: "https://example.com/listening.mp3",
      kind: "primaryAction",
    });
  });
});
