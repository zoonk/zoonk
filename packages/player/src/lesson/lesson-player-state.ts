import { type LessonStepCheckResult, type LessonSupport } from "@zoonk/core/lesson-player/contract";
import { type LessonPicture } from "@zoonk/core/lesson-player/playable-lesson";
import { type HelpLimit } from "@zoonk/learn/help-limit";
import { orderLessonOpening } from "./_utils/lesson-opening";
import {
  type LessonPlayerAnswer,
  type LessonPlayerCompletionState,
  type LessonPlayerLesson,
  type LessonRunAnswers,
  type LessonRunHyperdrive,
  type LessonRunRefusal,
  type LessonStepResult,
  type PlayableLibraryStep,
} from "./lesson-player-types";

type LessonPlayerPhase = "checking" | "completed" | "feedback" | "playing";

type CheckIssue = HelpLimit | { status: "noSpeech" };

type LessonPlayerRun =
  | { refusal: LessonRunRefusal; status: "refused" }
  | { carriedStepIds: string[]; hyperdrive: LessonRunHyperdrive; runId: string; status: "started" }
  | { status: "idle" }
  | { status: "starting" };

type QuickCheck = { missed: boolean; returnPosition: number; returnQueue: string[] };

export type LessonPlayerState = {
  answers: Record<string, LessonPlayerAnswer>;
  checkFailed: boolean;
  checkIssue: CheckIssue | null;
  completion:
    | LessonPlayerCompletionState
    | { result: null; status: "ready"; testedOut: boolean }
    | null;
  firstVerdicts: Record<string, boolean>;
  helped: string[];
  lessonId: string;
  misses: { skillId: string | null; stepId: string }[];
  notice: "answerNotSaved" | "pictureReady" | "selfCorrect" | "writingSkipped" | null;
  phase: LessonPlayerPhase;
  position: number;
  queue: string[];
  quickCheck: QuickCheck | null;
  results: Record<string, LessonStepResult>;
  retried: string[];
  revealed: Record<string, number>;
  run: LessonPlayerRun;
  reviewing: boolean;
  selfCorrected: string[];
  skippedWritingStepIds: string[];
  startedAt: number;
  stepStartedAt: number;
  steps: Record<string, PlayableLibraryStep>;
  support: LessonSupport | null;
  unavailableStepIds: string[];
  writingRestore: Pick<LessonPlayerState, "position" | "queue" | "skippedWritingStepIds"> | null;
};

export type LessonPlayerAction =
  | { answer: LessonPlayerAnswer | null; stepId: string; type: "selectAnswer" }
  | { counts: boolean; result: LessonStepResult; stepId: string; type: "checkResolved" }
  | { attemptId: string; result: LessonStepCheckResult; stepId: string; type: "checkConfirmed" }
  | { direction: "next" | "prev"; type: "navigate" }
  | { opening?: boolean; stepId?: string; type: "skipWriting" }
  | { stepIds: string[]; type: "skipSteps" }
  | { refusal: LessonRunRefusal; type: "runRefused" }
  | { result: LessonPlayerCompletionState["result"]; type: "completionSaved" }
  | {
      answers: LessonRunAnswers;
      hyperdrive: LessonRunHyperdrive;
      runId: string;
      startedAt: string;
      optionalStepIds?: string[];
      type: "runStarted";
    }
  | {
      answers: LessonRunAnswers;
      optionalStepIds?: string[];
      pictures?: LessonPicture[];
      runId?: string;
      type: "runResynced";
    }
  | { issue?: CheckIssue; stepId: string; type: "checkFailed" }
  | { stepId: string; type: "checkStarted" }
  | { type: "completionFailed" }
  | { type: "completionRetried" }
  | { type: "continue" }
  | { type: "explainFirst" }
  | { type: "knowThis" }
  | { type: "runStarting" }
  | { type: "writingRestored" };

export function createInitialState(
  lesson: Pick<LessonPlayerLesson, "id" | "steps">,
  support: LessonSupport | null = null,
): LessonPlayerState {
  const now = Date.now();
  const steps = Object.fromEntries(lesson.steps.map((step) => [step.id, step]));
  const queue = lesson.steps.map((step) => step.id);

  return {
    answers: {},
    checkFailed: false,
    checkIssue: null,
    completion: queue.length === 0 ? { result: null, status: "ready", testedOut: false } : null,
    firstVerdicts: {},
    helped: [],
    lessonId: lesson.id,
    misses: [],
    notice: null,
    phase: queue.length === 0 ? "completed" : "playing",
    position: 0,
    queue: orderLessonOpening({ queue, steps, support }),
    quickCheck: null,
    results: {},
    retried: [],
    revealed: {},
    reviewing: false,
    run: { status: "idle" },
    selfCorrected: [],
    skippedWritingStepIds: [],
    startedAt: now,
    stepStartedAt: now,
    steps,
    support,
    unavailableStepIds: [],
    writingRestore: null,
  };
}

export function getCurrentStep(state: LessonPlayerState): PlayableLibraryStep | null {
  const id = state.queue[state.position];
  return id ? (state.steps[id] ?? null) : null;
}
