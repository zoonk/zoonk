import { createErrorResponse, errors, httpStatus } from "./api-errors";
import { studySessionErrorCodes } from "./study-session-errors";

/**
 * Stable codes clients use to recover from a mock or exam request that can't be applied. A mock
 * is a session block, so the block's own refusals keep the session's codes.
 */
const examErrorCodes = {
  essayLimitReached: "ESSAY_LIMIT_REACHED",
  mockFinished: "MOCK_FINISHED",
  mockNotRunning: "MOCK_NOT_RUNNING",
  notExam: "NOT_AN_EXAM",
  timeUp: "SECTION_TIME_UP",
  tooEarly: "EXAM_NOT_TAKEN_YET",
} as const;

type ExamRefusal = {
  status:
    | "blockFinished"
    | "blockNotActive"
    | "dailyLimitReached"
    | "finished"
    | "invalidItem"
    | "limitReached"
    | "noGoal"
    | "notExam"
    | "notFound"
    | "notRunning"
    | "timeUp"
    | "tooEarly"
    | "unauthorized";
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
  invalidItem: {
    code: studySessionErrorCodes.invalidItem,
    message: "This question isn't in the running section",
    status: httpStatus.unprocessableEntity,
  },
  limitReached: {
    code: examErrorCodes.essayLimitReached,
    message: "Today's essay grades are used up",
    status: httpStatus.tooManyRequests,
  },
  notExam: {
    code: examErrorCodes.notExam,
    message: "This goal isn't an exam",
    status: httpStatus.unprocessableEntity,
  },
  notRunning: {
    code: examErrorCodes.mockNotRunning,
    message: "Start the mock first, or it moved on already",
    status: httpStatus.conflict,
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
