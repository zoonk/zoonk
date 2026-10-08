import { type LessonStepCheckResult, type LessonSupport } from "@zoonk/core/lesson-player/contract";
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

/**
 * Why the last answer wasn't graded when the connection wasn't the problem: nothing was heard in
 * the recording, or the learner's small AI help needs a short break or is used up for today.
 */
type CheckIssue = HelpLimit | { status: "noSpeech" };

type LessonPlayerRun =
  | { refusal: LessonRunRefusal; status: "refused" }
  | {
      /** Screens answered in earlier sittings, which Hyperdrive leaves out: it's this sitting's. */
      carriedStepIds: string[];
      hyperdrive: LessonRunHyperdrive;
      runId: string;
      status: "started";
    }
  | { status: "idle" }
  | { status: "starting" };

/** "I know this": the checks being asked, and where the lesson resumes if one is missed. */
type QuickCheck = { missed: boolean; returnPosition: number; returnQueue: string[] };

/**
 * The lesson in play. One reducer drives every screen kind: the player's parts read this state,
 * they never add their own.
 */
export type LessonPlayerState = {
  answers: Record<string, LessonPlayerAnswer>;
  /** The server couldn't grade the last typed or spoken answer; the learner can try again. */
  checkFailed: boolean;
  /** Why it wasn't graded, when it wasn't the connection. It clears with the next check or screen. */
  checkIssue: CheckIssue | null;
  completion: LessonPlayerCompletionState | null;
  /** The first verdict on each answerable screen, which is what the lesson counts. */
  firstVerdicts: Record<string, boolean>;
  /** Questions answered after "Explain first", so memory rates them as helped. */
  helped: string[];
  lessonId: string;
  /**
   * Answers missed in a row since the last right one, oldest first: two on the same idea mean the
   * learner is struggling (`getStruggleOffer`).
   */
  misses: { skillId: string | null; stepId: string }[];
  /**
   * A language answer was wrong and the learner gets to fix it before the answer shows, or an
   * answer never reached the server and the lesson came back to its screen to finish.
   */
  notice: "answerNotSaved" | "selfCorrect" | null;
  phase: LessonPlayerPhase;
  position: number;
  queue: string[];
  quickCheck: QuickCheck | null;
  results: Record<string, LessonStepResult>;
  /** Questions already sent to the end of the lesson once. */
  retried: string[];
  /** How many steps of each worked example are shown. */
  revealed: Record<string, number>;
  run: LessonPlayerRun;
  /**
   * Back on an answered screen with Previous: it shows its result again, without a sound, and
   * Continue goes on to where the learner was.
   */
  reviewing: boolean;
  /** Language answers that already had their one chance to self-correct. */
  selfCorrected: string[];
  startedAt: number;
  stepStartedAt: number;
  steps: Record<string, PlayableLibraryStep>;
  /** How the lesson opens for this learner, kept so starting over opens the same way. */
  support: LessonSupport | null;
};

export type LessonPlayerAction =
  | { answer: LessonPlayerAnswer | null; stepId: string; type: "selectAnswer" }
  | { counts: boolean; result: LessonStepResult; stepId: string; type: "checkResolved" }
  | { result: LessonStepCheckResult; stepId: string; type: "checkConfirmed" }
  | { direction: "next" | "prev"; type: "navigate" }
  | { kinds: PlayableLibraryStep["kind"][]; type: "skipKinds" }
  | { refusal: LessonRunRefusal; type: "runRefused" }
  | { result: LessonPlayerCompletionState["result"]; type: "completionSaved" }
  | {
      answers: LessonRunAnswers;
      hyperdrive: LessonRunHyperdrive;
      runId: string;
      startedAt: string;
      type: "runStarted";
    }
  | { answers: LessonRunAnswers; type: "runResynced" }
  | { issue?: CheckIssue; stepId: string; type: "checkFailed" }
  | { stepId: string; type: "checkStarted" }
  | { type: "completionFailed" }
  | { type: "completionRetried" }
  | { type: "continue" }
  | { type: "explainFirst" }
  | { type: "knowThis" }
  | { type: "runStarting" };

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
    completion: null,
    firstVerdicts: {},
    helped: [],
    lessonId: lesson.id,
    misses: [],
    notice: null,
    phase: "playing",
    position: 0,
    queue: orderLessonOpening({ queue, steps, support }),
    quickCheck: null,
    results: {},
    retried: [],
    revealed: {},
    reviewing: false,
    run: { status: "idle" },
    selfCorrected: [],
    startedAt: now,
    stepStartedAt: now,
    steps,
    support,
  };
}

/** The screen on show, if any. */
export function getCurrentStep(state: LessonPlayerState): PlayableLibraryStep | null {
  const id = state.queue[state.position];
  return id ? (state.steps[id] ?? null) : null;
}
