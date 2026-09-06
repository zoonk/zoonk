import { errors } from "./api-errors";

export function lessonQuestionAccessError(
  status: "notFound" | "subscriptionRequired" | "unauthorized",
) {
  if (status === "unauthorized") {
    return errors.unauthorized();
  }

  if (status === "subscriptionRequired") {
    return errors.paymentRequired();
  }

  return errors.notFound();
}
