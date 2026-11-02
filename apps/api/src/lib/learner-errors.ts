import { accessError, errors } from "./api-errors";
import { plusRequiredError } from "./lesson-player-errors";

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
