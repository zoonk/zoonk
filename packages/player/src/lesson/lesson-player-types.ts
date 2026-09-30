import { type LanguageActivityType } from "@zoonk/core/language/activities";
import {
  type LessonStepAnswer,
  type LessonStepCheckResult,
  type LibraryLessonCompletion,
  type LibraryLessonRun,
  type PlayableLibraryLesson,
} from "@zoonk/core/lesson-player/contract";
import { type SpokenAnswerGrade } from "@zoonk/core/library/language/spoken-answer-contract";

export type {
  LibraryLessonCompletion,
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

/** Where Hyperdrive starts: the session's streak so far and screens that would be repeats. */
export type LessonRunHyperdrive = LibraryLessonRun["hyperdrive"];

export type LessonStartOutcome =
  | LessonRunRefusal
  | { hyperdrive: LessonRunHyperdrive; reason: "started"; runId: string };

export type LessonCheckOutcome =
  | { result: LessonStepCheckResult; status: "checked" }
  | { status: "failed" }
  | { status: "runEnded" };

/** The session block's moment, when the lesson was one of today's blocks. */
export type StudyBlockCompletion = NonNullable<LibraryLessonCompletion["studyBlock"]>;

export type LessonCompletionOutcome =
  | { completion: LibraryLessonCompletion; status: "completed" }
  | { status: "failed" };

/** The learner used the small AI help their plan gives for today. */
export type HelpLimitOutcome = { status: "limitReached"; tier: LessonPlayerTier };

export type AnswerExplanationOutcome =
  | { explanation: string; explanationId: string; status: "explained" }
  | { status: "failed" }
  | HelpLimitOutcome
  | { retryAfterSeconds: number; status: "slowDown" };

export type StepVariantKind = "deeper" | "simpler";

/** A ready version carries its id, so a vote on it reaches the version rather than the screen. */
export type StepVariantOutcome =
  | { content: unknown; id: string; status: "ready" }
  | { status: "failed" }
  | HelpLimitOutcome
  | { retryAfterSeconds: number; status: "slowDown" }
  | { status: "unsupported" };

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
  /** "Simpler" and "Go deeper". Without it, only versions already made are offered. */
  requestVariant?: (input: {
    kind: StepVariantKind;
    stepId: string;
  }) => Promise<StepVariantOutcome>;
  startLesson: () => Promise<LessonStartOutcome>;
};

/** Where the player's links go, supplied by the host. */
export type LessonPlayerRoutes = {
  /** Where closing the lesson goes. */
  exit: string;
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
