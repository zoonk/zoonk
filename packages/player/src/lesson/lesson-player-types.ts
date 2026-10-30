import {
  type LessonStepAnswer,
  type LessonStepCheckResult,
  type LibraryLessonCompletion,
  type LibraryLessonRun,
} from "@zoonk/core/lesson-player/contract";
import {
  type LessonPicture,
  type PlayableLibraryLesson,
} from "@zoonk/core/lesson-player/playable-lesson";
import { type SpokenAnswerGrade } from "@zoonk/core/library/language/spoken-answer-contract";

export type {
  PlayableLanguageStep,
  PlayableLibraryLesson,
  PlayableLibraryStep,
  PlayableStepImage,
  PlayableWordHints,
} from "@zoonk/core/lesson-player/playable-lesson";

export type { LessonTutorConfig } from "./tutor/lesson-tutor-context";

export type LessonPlayerAnswer = LessonStepAnswer | { kind: "hook"; optionId: string };

export type SpokenAnswerHeard = Pick<SpokenAnswerGrade, "transcript" | "words" | "wordsToPractice">;

export type LessonStepResult = LessonStepCheckResult & {
  answerText: string | null;
  attemptId?: string;
  heard: SpokenAnswerHeard | null;
};

type LessonPlayerTier = "free" | "guest" | "plus";

export type LessonRunRefusal =
  | { reason: "failed" }
  | { period: "day" | "month" | "total"; reason: "limitReached"; tier: LessonPlayerTier }
  | { reason: "notFound" }
  | { reason: "plusRequired" }
  | { reason: "slowDown"; retryAfterSeconds: number }
  | { reason: "unauthorized" };

/** Answers must be ordered oldest first, including earlier unfinished sittings. */
export type LessonRunAnswers = LibraryLessonRun["answers"];

export type LessonRunHyperdrive = LibraryLessonRun["hyperdrive"];

export type LessonStartOutcome =
  | LessonRunRefusal
  | {
      answers: LessonRunAnswers;
      hyperdrive: LessonRunHyperdrive;
      optionalStepIds?: string[];
      reason: "started";
      runId: string;
      startedAt: string;
    };

/** Retry `failed` outcomes; `refused` outcomes must not be retried. */
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

type HelpLimitOutcome =
  | { period?: "day" | "month" | "total"; status: "limitReached"; tier: LessonPlayerTier }
  | { status: "signUpRequired" };

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

export type ExampleLine = { line: string | null };

/** Hosts own auth and transport; omitting an optional adapter disables its controls. */
export type LessonPlayerAdapters = {
  /** Retries must reuse the answer's `attemptId` so the server records it only once. */
  checkStep: (input: {
    answer: LessonStepAnswer;
    attemptId: string;
    durationMs: number;
    runId: string;
    stepId: string;
    usedHelp: boolean;
  }) => Promise<LessonCheckOutcome>;
  completeLesson: (input: {
    runId: string;
    skippedWritingStepIds?: string[];
  }) => Promise<LessonCompletionOutcome>;
  /** Reads saved examples only; opening a screen must never generate one. Null means the read failed. */
  getExampleLine?: (input: { stepId: string }) => Promise<ExampleLine | null>;
  /** Writes all missing lesson examples in one call after a learner action. Null means failure or refusal. */
  requestExampleLine?: (input: { stepId: string }) => Promise<ExampleLine | null>;
  /** Omit `stepIds` to read every screen's pictures. */
  getLessonPictures?: (stepIds?: string[]) => Promise<LessonPicture[]>;
  explainAnswer?: (input: { answer: string; stepId: string }) => Promise<AnswerExplanationOutcome>;
  /** Grades a recording of a spoken answer. Without it, spoken screens take a typed answer. */
  gradeSpokenAnswer?: (input: {
    audio: Blob;
    durationMs: number;
    stepId: string;
  }) => Promise<SpokenAnswerOutcome>;
  startLesson: (input?: { runId: string }) => Promise<LessonStartOutcome>;
};

export type LessonPlayerRoutes = {
  exit: string;
  /** Set when `exit` points to the lesson's chapter or language unit. */
  exitTo: "chapter" | "unit" | null;
  nextLesson: string | null;
  signUp: string;
  upgrade: string;
};

export type LessonPlayerCompletionState = {
  result: LibraryLessonCompletion | null;
  status: "failed" | "saved" | "saving";
  /** True when I know this passed every check and skipped the rest. */
  testedOut: boolean;
};

export type LessonPlayerLesson = Pick<
  PlayableLibraryLesson,
  "estimatedMinutes" | "id" | "language" | "steps" | "summaryIdeas" | "title"
>;
