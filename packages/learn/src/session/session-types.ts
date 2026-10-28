import { type StudyBlockResult } from "@zoonk/core/sessions/block";
import { type StudyBlockCompletionView } from "@zoonk/core/sessions/completion-contract";
import { type QuestionAnswer, type StudyAnswerResult } from "@zoonk/core/sessions/contract";
import { type DayBlockView, type DayView } from "@zoonk/core/sessions/day-view";
import { type StudySessionResult } from "@zoonk/core/sessions/get";
import { type StudySessionSummaryResult } from "@zoonk/core/sessions/summary";

export type StudySession = Extract<StudySessionResult, { status: "ready" }>["session"];

export type StudyBlock = StudySession["blocks"][number];

export type StudyDay = DayView;

export type DayStep = StudyBlock | DayBlockView;

/** Never carries the answers. */
export type StudyBlockDetail = Extract<StudyBlockResult, { status: "ready" }>["detail"];

export type StudyQuestion = StudyBlockDetail["questions"][number];

export type StudyAnswerFeedback = Extract<StudyAnswerResult, { status: "ready" }>["feedback"];

export type StudySessionSummary = Extract<
  StudySessionSummaryResult,
  { status: "ready" }
>["summary"];

export type StudyMomentView = StudyBlockCompletionView;

export type StudyQuestionAnswer = QuestionAnswer;

export type StudyAnswerOutcome =
  | { feedback: StudyAnswerFeedback; status: "answered" }
  | { status: "alreadyAnswered" | "blockNotActive" }
  | { status: "failed" };

export type StudyFinishOutcome =
  | { moment: StudyMomentView; status: "finished" }
  | { status: "failed" };
