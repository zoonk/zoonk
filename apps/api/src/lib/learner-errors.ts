import { accessError, errors } from "./api-errors";
import { plusRequiredError } from "./lesson-player-errors";

/**
 * Maps a learner-model capability's non-ready outcome to the shared error envelope. `plusRequired`
 * is 402 `PLUS_REQUIRED`: a free exam plan past its first week takes it with Plus only.
 */
export function learnerAccessError(
  status: "invalidItem" | "notFound" | "plusRequired" | "unauthorized",
) {
  if (status === "invalidItem") {
    return errors.unprocessableEntity("This question can't be answered here");
  }

  if (status === "plusRequired") {
    return plusRequiredError();
  }

  return accessError(status);
}
