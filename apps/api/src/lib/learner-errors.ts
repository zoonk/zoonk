import { accessError, errors } from "./api-errors";

/** Maps a learner-model capability's non-ready outcome to the shared error envelope. */
export function learnerAccessError(status: "invalidItem" | "notFound" | "unauthorized") {
  if (status === "invalidItem") {
    return errors.unprocessableEntity("This question can't be answered here");
  }

  return accessError(status);
}
