import { createErrorResponse, errors, httpStatus } from "./api-errors";
import { notLanguageError } from "./language-errors";

type LevelTestRefusal = "invalid" | "notFound" | "notLanguage" | "notReady" | "unauthorized";

/** Maps a level test outcome that isn't ready to the shared error envelope. */
export function levelTestError(status: LevelTestRefusal) {
  if (status === "unauthorized") {
    return errors.unauthorized();
  }

  if (status === "notLanguage") {
    return notLanguageError();
  }

  if (status === "notReady") {
    return createErrorResponse({
      code: "LEVEL_TEST_PREPARING",
      message: "The test's questions are still being written. Try again in a few seconds.",
      status: httpStatus.conflict,
    });
  }

  if (status === "invalid") {
    return errors.unprocessableEntity("That isn't the test's current question");
  }

  return errors.notFound("Goal not found");
}
