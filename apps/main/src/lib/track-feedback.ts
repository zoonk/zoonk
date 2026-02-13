import { track } from "@vercel/analytics";

export type FeedbackKind = "activity" | "course" | "chapter" | "lesson" | "courseSuggestions";

export type FeedbackValue = "upvote" | "downvote";

const FEEDBACK_VALUES: ReadonlySet<string> = new Set<FeedbackValue>(["upvote", "downvote"]);

export function isFeedbackValue(value: string): value is FeedbackValue {
  return FEEDBACK_VALUES.has(value);
}

export function trackFeedback({
  contentId,
  feedback,
  kind,
}: {
  contentId: string;
  feedback: FeedbackValue;
  kind: FeedbackKind;
}) {
  track("Feedback", { contentId, feedback, kind });
}
