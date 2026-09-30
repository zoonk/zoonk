import { type StudyBlockResult } from "@zoonk/core/sessions/block";
import { type StudyBlockCompletionView } from "@zoonk/core/sessions/completion-contract";
import { type QuestionAnswer, type StudyAnswerResult } from "@zoonk/core/sessions/contract";
import { type StudySessionResult } from "@zoonk/core/sessions/get";
import { type StudySessionSummaryResult } from "@zoonk/core/sessions/summary";

/** Today's session as core builds it: the same view model for the Focus card and the flight plan. */
export type StudySession = Extract<StudySessionResult, { status: "ready" }>["session"];

export type StudyBlock = StudySession["blocks"][number];

/** A question block with its questions (never their answers) and what was answered already. */
export type StudyBlockDetail = Extract<StudyBlockResult, { status: "ready" }>["detail"];

export type StudyQuestion = StudyBlockDetail["questions"][number];

export type StudyAnswerFeedback = Extract<StudyAnswerResult, { status: "ready" }>["feedback"];

export type StudySessionSummary = Extract<
  StudySessionSummaryResult,
  { status: "ready" }
>["summary"];

export type StudyMomentView = StudyBlockCompletionView;

/** A learner's answer to a session question, in the shape core grades. */
export type StudyQuestionAnswer = QuestionAnswer;

/** What answering can come back with, as the host maps it for the screen. */
export type StudyAnswerOutcome =
  | { feedback: StudyAnswerFeedback; status: "answered" }
  | { retryAfterSeconds: number; status: "slowDown" }
  | { status: "alreadyAnswered" }
  | { status: "failed" };

export type StudyFinishOutcome =
  | { moment: StudyMomentView; status: "finished" }
  | { status: "failed" };
