import { getLearnerLabel } from "@/lib/learner-label";
import { type FeedbackReportType } from "@zoonk/core/feedback/contract";
import { type FeedbackContentKind, type FeedbackStatus, type User } from "@zoonk/db";

export const feedbackContentKindLabels: Record<FeedbackContentKind, string> = {
  answerExplanation: "Answer explanation",
  chapter: "Chapter",
  course: "Course",
  item: "Item",
  lesson: "Lesson",
  lessonQuestion: "Tutor answer",
  mediaAsset: "Media",
  plan: "Plan",
  planChange: "Plan change",
  step: "Step",
  stepVariant: "Step variant",
};

export const feedbackStatusLabels: Record<FeedbackStatus, string> = {
  new: "New",
  read: "Read",
  replied: "Replied",
};

export const feedbackReportTypeLabels: Record<FeedbackReportType, string> = {
  saveFailure: "Save problem",
};

export function getFeedbackLearnerLabel(
  user: Pick<User, "email" | "isAnonymous" | "name" | "username">,
): string {
  return user.isAnonymous ? "Guest" : getLearnerLabel(user);
}

export function getFeedbackStatusVariant(status: FeedbackStatus) {
  if (status === "new") {
    return "default" as const;
  }

  return status === "replied" ? ("success" as const) : ("secondary" as const);
}
