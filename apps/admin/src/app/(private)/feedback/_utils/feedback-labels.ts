import { type parseFeedbackMessageContext } from "@/data/feedback/_utils/feedback-message-context";
import { getLearnerLabel } from "@/lib/learner-label";
import { type FeedbackReportType } from "@zoonk/core/feedback/contract";
import { type FeedbackContentKind, type FeedbackStatus, type User } from "@zoonk/db";

const feedbackContentKindLabels: Record<FeedbackContentKind, string> = {
  answerExplanation: "Answer explanation",
  chapter: "Chapter",
  course: "Course",
  item: "Practice question",
  lesson: "Lesson",
  lessonQuestion: "Buddy answer",
  mediaAsset: "Media",
  plan: "Plan",
  planChange: "Plan change",
  step: "Screen",
  stepVariant: "Screen variant",
};

export const feedbackStatusLabels: Record<FeedbackStatus, string> = {
  new: "New",
  read: "Read",
  replied: "Replied",
};

const feedbackReportTypeLabels: Record<FeedbackReportType, string> = {
  saveFailure: "Save problem",
};

type FeedbackContext = ReturnType<typeof parseFeedbackMessageContext>;

/** What a message is about, in one phrase: the problem reported, else the content, else the page. */
export function getFeedbackSubject(context: FeedbackContext): string {
  if (context.reportType) {
    return feedbackReportTypeLabels[context.reportType];
  }

  if (context.contentKind) {
    return feedbackContentKindLabels[context.contentKind];
  }

  return context.screen ?? context.url ?? "Not recorded";
}

const platformNames: Partial<Record<string, string>> = {
  android: "Android",
  ios: "iOS",
  web: "Web",
};

export function getFeedbackPlatform(context: FeedbackContext): string | null {
  if (!context.platform) {
    return null;
  }

  return [platformNames[context.platform] ?? context.platform, context.appVersion]
    .filter(Boolean)
    .join(" ");
}

export function getFeedbackLearnerLabel(
  user: Pick<User, "email" | "isAnonymous" | "name" | "username">,
): string {
  return user.isAnonymous ? "Guest" : getLearnerLabel(user);
}
