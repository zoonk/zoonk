import { type OpenStudyDayResult } from "@zoonk/core/sessions/open-day-contract";
import { createErrorResponse, httpStatus } from "./api-errors";
import { studySessionError } from "./study-session-errors";
import { todayErrorCodes } from "./today-errors";

/** A conflict keeps the original goal and day for one separate-request retry. */
export function openStudyDayError(result: Exclude<OpenStudyDayResult, { status: "opened" }>) {
  if (result.status === "preparing") {
    return createErrorResponse({
      code: todayErrorCodes.planNotReady,
      message: "Your plan is still being built",
      status: httpStatus.conflict,
    });
  }

  if (result.status === "empty" || result.status === "retryable") {
    return createErrorResponse({
      code: result.status === "retryable" ? "STUDY_DAY_RETRYABLE" : "NOTHING_TO_OPEN",
      details: { goalId: result.goalId, localDate: result.localDate.toISOString().slice(0, 10) },
      message:
        result.status === "retryable"
          ? "The plan changed while the day opened. Try again."
          : "There is no study day to open",
      status: httpStatus.conflict,
    });
  }

  return studySessionError({ status: result.status });
}
