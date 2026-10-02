import {
  type ContentFeedbackReason,
  type ExperienceMode,
  type FeedbackContentKind,
  type FeedbackStatus,
  type VoteValue,
} from "@zoonk/db";

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

export const feedbackReasonLabels: Record<ContentFeedbackReason, string> = {
  hardToFollow: "Hard to follow",
  notWhatINeeded: "Not what I needed",
  somethingElse: "Something else",
  tooEasy: "Too easy",
  tooHard: "Too hard",
  wrongOrOutdated: "Wrong or outdated",
};

/** Reasons as one readable line, or a dash for a vote without any. */
export function formatFeedbackReasons(reasons: ContentFeedbackReason[]): string {
  return reasons.length > 0
    ? reasons.map((reason) => feedbackReasonLabels[reason]).join(", ")
    : "—";
}

export const voteLabels: Record<VoteValue, string> = { down: "Not helpful", up: "Helpful" };

export const experienceModeLabels: Record<ExperienceMode, string> = { focus: "Focus", fun: "Fun" };

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
