import { type AnalyticsEvent } from "@zoonk/core/analytics/events";
import { type FeedbackContext, type FeedbackMessageInput } from "@zoonk/core/feedback/contract";

export type FeedbackFormContext = Pick<FeedbackContext, "contentId" | "contentKind" | "screen">;

export type FeedbackFormRequest = { context: FeedbackFormContext; isReport: boolean };

/** `sendMessage` resolves to whether it was saved. */
export type ContentFeedbackAdapters = {
  getViewerEmail: () => Promise<string | null>;
  platform: NonNullable<FeedbackContext["platform"]>;
  sendMessage: (input: FeedbackMessageInput) => Promise<boolean>;
  track: (event: AnalyticsEvent) => void;
};
