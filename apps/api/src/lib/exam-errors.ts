import { createErrorResponse, errors, httpStatus } from "./api-errors";
import { studySessionErrorCodes } from "./study-session-errors";

/**
 * Stable codes clients use to recover from a mock or exam request that can't be applied. A mock
 * is a session block, so the block's own refusals keep the session's codes.
 */
const examErrorCodes = {
  essayLimitReached: "ESSAY_LIMIT_REACHED",
  invalidMockOption: "INVALID_MOCK_OPTION",
  mockAnswerLocked: "MOCK_ANSWER_LOCKED",
  mockFinished: "MOCK_FINISHED",
  mockNotFinished: "MOCK_NOT_FINISHED",
  mockNotOnBreak: "MOCK_NOT_ON_BREAK",
  mockNotRunning: "MOCK_NOT_RUNNING",
  mockNotSpeaking: "MOCK_NOT_SPEAKING",
  mockPlaysUsed: "MOCK_PLAYS_USED",
  notEnoughQuestions: "NOT_ENOUGH_QUESTIONS",
  notExam: "NOT_AN_EXAM",
  plusRequired: "PLUS_REQUIRED",
  timeUp: "SECTION_TIME_UP",
  tooEarly: "EXAM_NOT_TAKEN_YET",
} as const;

type ExamRefusal = {
  status:
    | "blockFinished"
    | "blockNotActive"
    | "dailyLimitReached"
    | "finished"
    | "goalNotActive"
    | "invalidItem"
    | "invalidOption"
    | "invalidSet"
    | "limitReached"
    | "locked"
    | "noGoal"
    | "notEnoughQuestions"
    | "notExam"
    | "notFinished"
    | "notFound"
    | "notOnBreak"
    | "notRunning"
    | "notSpeaking"
    | "plusRequired"
    | "timeUp"
    | "tooEarly"
    | "unauthorized"
    | "usedUp";
};

const REFUSALS = {
  blockFinished: {
    code: studySessionErrorCodes.blockFinished,
    message: "This mock's block is already finished",
    status: httpStatus.conflict,
  },
  blockNotActive: {
    code: studySessionErrorCodes.blockNotActive,
    message: "Start the block before sending the essay",
    status: httpStatus.conflict,
  },
  dailyLimitReached: {
    code: studySessionErrorCodes.dailyLimitReached,
    message: "Today's time limit is reached",
    status: httpStatus.forbidden,
  },
  finished: {
    code: examErrorCodes.mockFinished,
    message: "This mock is already finished",
    status: httpStatus.conflict,
  },
  goalNotActive: {
    code: studySessionErrorCodes.goalNotActive,
    message: "Resume the goal to take a mock",
    status: httpStatus.conflict,
  },
  invalidItem: {
    code: studySessionErrorCodes.invalidItem,
    message: "This question isn't in the running section",
    status: httpStatus.unprocessableEntity,
  },
  invalidOption: {
    code: examErrorCodes.invalidMockOption,
    message: "That isn't one of the goal's mocks; list them again",
    status: httpStatus.unprocessableEntity,
  },
  invalidSet: {
    code: studySessionErrorCodes.invalidItem,
    message: "This recording isn't in the running listening section",
    status: httpStatus.unprocessableEntity,
  },
  limitReached: {
    code: examErrorCodes.essayLimitReached,
    message: "Today's essay grades are used up",
    status: httpStatus.tooManyRequests,
  },
  locked: {
    code: examErrorCodes.mockAnswerLocked,
    message: "This section never goes back to a question left behind",
    status: httpStatus.conflict,
  },
  notEnoughQuestions: {
    code: examErrorCodes.notEnoughQuestions,
    message: "There aren't enough questions for this mock yet",
    status: httpStatus.unprocessableEntity,
  },
  notExam: {
    code: examErrorCodes.notExam,
    message: "This goal isn't an exam",
    status: httpStatus.unprocessableEntity,
  },
  notFinished: {
    code: examErrorCodes.mockNotFinished,
    message: "Hand the mock in first",
    status: httpStatus.conflict,
  },
  notOnBreak: {
    code: examErrorCodes.mockNotOnBreak,
    message: "The mock isn't on a break",
    status: httpStatus.conflict,
  },
  notRunning: {
    code: examErrorCodes.mockNotRunning,
    message: "Start the mock first, or it moved on already",
    status: httpStatus.conflict,
  },
  notSpeaking: {
    code: examErrorCodes.mockNotSpeaking,
    message: "The mock isn't on its speaking section",
    status: httpStatus.conflict,
  },
  plusRequired: {
    code: examErrorCodes.plusRequired,
    message: "Mock exams come with Plus",
    status: httpStatus.paymentRequired,
  },
  timeUp: {
    code: examErrorCodes.timeUp,
    message: "This section's time ran out",
    status: httpStatus.conflict,
  },
  tooEarly: {
    code: examErrorCodes.tooEarly,
    message: "The exam hasn't happened yet",
    status: httpStatus.conflict,
  },
  usedUp: {
    code: examErrorCodes.mockPlaysUsed,
    message: "This recording has no plays left",
    status: httpStatus.conflict,
  },
} as const;

/** Maps a mock or exam refusal to its response, with a code clients can act on. */
export function examError(result: ExamRefusal) {
  if (result.status === "unauthorized") {
    return errors.unauthorized();
  }

  if (result.status === "notFound" || result.status === "noGoal") {
    return errors.notFound();
  }

  return createErrorResponse(REFUSALS[result.status]);
}
