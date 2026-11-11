import { type ProfileAnswerResult } from "@zoonk/core/profile/questions/answer";
import { createErrorResponse, errors, httpStatus } from "./api-errors";

export function profileQuestionError(status: Exclude<ProfileAnswerResult["status"], "saved">) {
  if (status === "unauthorized") {
    return errors.unauthorized();
  }

  if (status === "invalid") {
    return errors.unprocessableEntity();
  }

  return createErrorResponse({
    code: status === "memoryOff" ? "MEMORY_OFF" : "CONSENT_REQUIRED",
    message:
      status === "memoryOff"
        ? "Memory is off. Turn it on to save this answer"
        : "Conditions are saved only with your consent",
    status: status === "memoryOff" ? httpStatus.conflict : httpStatus.unprocessableEntity,
  });
}
