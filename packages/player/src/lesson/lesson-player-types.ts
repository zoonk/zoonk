import { type LanguageActivityType } from "@zoonk/core/language/activities";
import {
  type LessonPicture,
  type LessonStepAnswer,
  type LessonStepCheckResult,
  type LibraryLessonCompletion,
  type LibraryLessonRun,
  type PlayableLibraryLesson,
} from "@zoonk/core/lesson-player/contract";
import { type SpokenAnswerGrade } from "@zoonk/core/library/language/spoken-answer-contract";

export type {
  PlayableLanguageStep,
  PlayableLibraryLesson,
  PlayableLibraryStep,
  PlayableStepImage,
  PlayableWordHints,
} from "@zoonk/core/lesson-player/contract";

export type { LessonTutorConfig } from "./tutor/lesson-tutor-context";

/** What the learner picked or wrote on a screen. A hook's guess never counts, so only the player sees it. */
export type LessonPlayerAnswer = LessonStepAnswer | { kind: "hook"; optionId: string };

/** How a spoken answer came out, word by word. */
export type SpokenAnswerHeard = Pick<SpokenAnswerGrade, "transcript" | "words" | "wordsToPractice">;

/** The verdict on one screen as the learner sees it, with their answer as text. */
export type LessonStepResult = LessonStepCheckResult & {
  answerText: string | null;
  heard: SpokenAnswerHeard | null;
};

/** The learner's plan, as far as a refusal needs it: guests are asked to sign up. */
type LessonPlayerTier = "free" | "guest" | "plus";

/** Why a lesson can't start or continue right now. */
export type LessonRunRefusal =
  | { reason: "failed" }
  | { period: "day" | "month" | "total"; reason: "limitReached"; tier: LessonPlayerTier }
  | { reason: "notFound" }
  | { reason: "slowDown"; retryAfterSeconds: number }
  | { reason: "unauthorized" };

/**
 * The lesson's answers so far, oldest first, this sitting's and those of earlier sittings left
 * unfinished: a lesson the learner comes back to resumes after them.
 */
export type LessonRunAnswers = LibraryLessonRun["answers"];

/** Where Hyperdrive stood when the run started: the session's streak and screens that are repeats. */
export type LessonRunHyperdrive = LibraryLessonRun["hyperdrive"];

export type LessonStartOutcome =
  | LessonRunRefusal
  | {
      answers: LessonRunAnswers;
      hyperdrive: LessonRunHyperdrive;
      reason: "started";
      runId: string;
      /** When this sitting's run started: earlier answers came from sittings before it. */
      startedAt: string;
    };

/**
 * `failed` is worth sending again (the connection, the server); `refused` never is (the run
 * finished, or the answer doesn't fit the screen), so the completion goes on without it.
 */
export type LessonCheckOutcome =
  | { result: LessonStepCheckResult; status: "checked" }
  | { status: "failed" }
  | { status: "refused" };

/**
 * `incomplete`: the server is missing an answer the learner gave (it never arrived), so the
 * lesson goes back to that screen instead of asking to save again and again.
 */
export type LessonCompletionOutcome =
  | { completion: LibraryLessonCompletion; status: "completed" }
  | { status: "failed" }
  | { status: "incomplete" };

/** The learner used the small AI help their plan gives for the day or the month (`period`). */
type HelpLimitOutcome = {
  period?: "day" | "month" | "total";
  status: "limitReached";
  tier: LessonPlayerTier;
};

export type AnswerExplanationOutcome =
  | { explanation: string; status: "explained" }
  | { status: "failed" }
  | HelpLimitOutcome
  | { retryAfterSeconds: number; status: "slowDown" };

export type SpokenAnswerOutcome =
  | { grade: SpokenAnswerGrade; status: "graded" }
  | { status: "failed" }
  | HelpLimitOutcome
  | { status: "noSpeech" }
  | { retryAfterSeconds: number; status: "slowDown" };

/**
 * How the player reaches the server. The host implements these (the web app over its own
 * routes, a native app over the public API), so the player never knows about auth or URLs.
 * Optional adapters turn their controls off when missing.
 */
export type LessonPlayerAdapters = {
  checkStep: (input: {
    answer: LessonStepAnswer;
    durationMs: number;
    runId: string;
    stepId: string;
    usedHelp: boolean;
  }) => Promise<LessonCheckOutcome>;
  completeLesson: (input: { runId: string }) => Promise<LessonCompletionOutcome>;
  /**
   * One sentence tying an explanation to the learner's life, for screens with an example-line
   * slot. It arrives after the screen shows, so the lesson never waits for it.
   */
  getExampleLine?: (input: { stepId: string }) => Promise<string | null>;
  /**
   * The lesson's pictures drawn so far, asked for while a screen's picture is still being drawn
   * (`imagePending`). Without it, those screens show without their picture.
   */
  getLessonPictures?: () => Promise<LessonPicture[]>;
  /** Shares the explanation of a wrong typed answer ("Explain answer"). */
  explainAnswer?: (input: { answer: string; stepId: string }) => Promise<AnswerExplanationOutcome>;
  /** Grades a recording of a spoken answer. Without it, spoken screens take a typed answer. */
  gradeSpokenAnswer?: (input: {
    audio: Blob;
    durationMs: number;
    stepId: string;
  }) => Promise<SpokenAnswerOutcome>;
  /**
   * "Skip writing" in a language lesson: leaves that practice out of the learner's plan, so this
   * and later lessons skip it until they turn it back on. Without it, the control isn't shown.
   */
  skipLanguageActivity?: (activity: LanguageActivityType) => Promise<boolean>;
  startLesson: () => Promise<LessonStartOutcome>;
};

/** Where the player's links go, supplied by the host. */
export type LessonPlayerRoutes = {
  /** Where closing the lesson goes: back where the learner opened it from. */
  exit: string;
  /** What `exit` is when it's the lesson's chapter (a language goal calls it a unit), for its link. */
  exitTo: "chapter" | "unit" | null;
  /**
   * The lesson after this one in the chapter it was opened from, which the completion moment
   * opens next ("Next lesson", with "Back to chapter" going to `exit`). Null without one.
   */
  nextLesson: string | null;
  /** Account creation, for a guest who used their lessons. */
  signUp: string;
  /** Plus, for a learner who used the free plan's lessons. */
  upgrade: string;
};

export type LessonPlayerCompletionState = {
  /** The server's result once saved; null while saving or when it failed. */
  result: LibraryLessonCompletion | null;
  status: "failed" | "saved" | "saving";
  /** "I know this" passed every check and skipped the rest. */
  testedOut: boolean;
};

export type LessonPlayerLesson = Pick<
  PlayableLibraryLesson,
  "estimatedMinutes" | "id" | "language" | "steps" | "summaryIdeas" | "title"
>;
