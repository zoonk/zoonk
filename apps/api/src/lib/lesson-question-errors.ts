import { errors } from "./api-errors";

export function lessonQuestionAccessError(status: "notFound" | "unauthorized") {
  if (status === "unauthorized") {
    return errors.unauthorized();
  }

  return errors.notFound();
}
