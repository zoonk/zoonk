import { type FeedbackContentKind, type FeedbackStatus } from "@zoonk/db";

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

/** A new message still needs someone to read it, so it stands out in the list. */
export function getFeedbackStatusVariant(status: FeedbackStatus) {
  if (status === "new") {
    return "default" as const;
  }

  return status === "replied" ? ("success" as const) : ("secondary" as const);
}

/** The learner as admins recognize them: name first, then username or email. */
export function getLearnerLabel(user: {
  email: string;
  name: string | null;
  username: string | null;
}): string {
  return user.name || user.username || user.email;
}
