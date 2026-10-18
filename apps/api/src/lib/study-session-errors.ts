import { type ExtraStudyBlockResult } from "@zoonk/core/sessions/extra-block";
import { type StartStudyBlockResult } from "@zoonk/core/sessions/start-block";
import { createErrorResponse, errors, httpStatus } from "./api-errors";

/** Stable codes clients use to recover from a session request that can't be applied. */
export const studySessionErrorCodes = {
  alreadyAnswered: "ALREADY_ANSWERED",
  blockFinished: "BLOCK_FINISHED",
  blockNotActive: "BLOCK_NOT_ACTIVE",
  dailyLimitReached: "DAILY_LIMIT_REACHED",
  earlierFirst: "EARLIER_FIRST",
  extraTimeUnavailable: "EXTRA_TIME_UNAVAILABLE",
  goalNotActive: "GOAL_NOT_ACTIVE",
  invalidItem: "INVALID_ITEM",
  lessonNotFinished: "LESSON_NOT_FINISHED",
  noAnswers: "NO_ANSWERS",
  nothingToCatchUp: "NOTHING_TO_CATCH_UP",
  nothingToPractice: "NOTHING_TO_PRACTICE",
  plusRequired: "PLUS_REQUIRED",
  questionsNeeded: "QUESTIONS_NEEDED",
  unanswered: "UNANSWERED_QUESTIONS",
} as const;

/** Why "10 more minutes" (or a bonus block like it) isn't available. */
type ExtraTimeReason = Extract<ExtraStudyBlockResult, { status: "unavailable" }>["reason"];

type StudySessionRefusal =
  | Extract<StartStudyBlockResult, { status: "earlierFirst" }>
  | { reason: ExtraTimeReason; status: "unavailable" }
  | {
      status:
        | "alreadyAnswered"
        | "blockFinished"
        | "blockNotActive"
        | "dailyLimitReached"
        | "goalNotActive"
        | "invalidItem"
        | "lessonNotFinished"
        | "noAnswers"
        | "notFound"
        | "nothingToCatchUp"
        | "nothingToPractice"
        | "plusRequired"
        | "questionsNeeded"
        | "unanswered"
        | "unauthorized";
    };

const REFUSALS = {
  alreadyAnswered: { message: "This question was already answered", status: httpStatus.conflict },
  blockFinished: { message: "This block is already finished", status: httpStatus.conflict },
  blockNotActive: { message: "Start the block before answering", status: httpStatus.conflict },
  dailyLimitReached: { message: "Today's time limit is reached", status: httpStatus.forbidden },
  goalNotActive: { message: "This goal is paused or finished", status: httpStatus.conflict },
  invalidItem: {
    message: "This question isn't part of the block",
    status: httpStatus.unprocessableEntity,
  },
  lessonNotFinished: { message: "Finish the lesson first", status: httpStatus.conflict },
  noAnswers: {
    message: "Answer at least one question first",
    status: httpStatus.unprocessableEntity,
  },
  nothingToCatchUp: {
    message: "There are no lessons left to catch up on",
    status: httpStatus.unprocessableEntity,
  },
  nothingToPractice: {
    message: "There is nothing more to practice today",
    status: httpStatus.unprocessableEntity,
  },
  plusRequired: {
    message: "The learner's plan leaves this to Plus",
    status: httpStatus.paymentRequired,
  },
  questionsNeeded: {
    message: "Its questions aren't written yet: write them, then start it again",
    status: httpStatus.conflict,
  },
  unanswered: {
    message: "A checkpoint needs every question answered, unless a boss's duel is already decided",
    status: httpStatus.unprocessableEntity,
  },
} as const;

/** Maps a study-session capability's refusal to the shared error envelope. */
export function studySessionError(refusal: StudySessionRefusal) {
  if (refusal.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (refusal.status === "notFound") {
    return errors.notFound();
  }

  if (refusal.status === "unavailable") {
    return createErrorResponse({
      code: studySessionErrorCodes.extraTimeUnavailable,
      details: { reason: refusal.reason },
      message: "More time isn't available right now",
      status: httpStatus.conflict,
    });
  }

  if (refusal.status === "earlierFirst") {
    return createErrorResponse({
      code: studySessionErrorCodes.earlierFirst,
      details: { reason: refusal.reason },
      message:
        refusal.reason === "lessons"
          ? "Finish the earlier lessons first"
          : "Finish the earlier challenge first",
      status: httpStatus.conflict,
    });
  }

  const { message, status } = REFUSALS[refusal.status];
  return createErrorResponse({ code: studySessionErrorCodes[refusal.status], message, status });
}
