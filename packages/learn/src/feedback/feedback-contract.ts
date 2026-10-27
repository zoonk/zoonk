import { type AnalyticsEvent } from "@zoonk/core/analytics/events";
import { type FeedbackContext, type FeedbackMessageInput } from "@zoonk/core/feedback/contract";

/** Where a message is written from; the form adds the page and platform itself. */
export type FeedbackFormContext = Pick<FeedbackContext, "contentId" | "contentKind" | "screen">;

/** A report is a message about the content on screen, from its menu's "Report a problem". */
export type FeedbackFormRequest = { context: FeedbackFormContext; isReport: boolean };

/**
 * How feedback reaches the server. The host implements these, so the components never know about
 * auth or URLs. `sendMessage` resolves to whether it was saved.
 */
export type ContentFeedbackAdapters = {
  /** The signed-in learner's email, to fill in the message form. Null for guests and visitors. */
  getViewerEmail: () => Promise<string | null>;
  platform: NonNullable<FeedbackContext["platform"]>;
  sendMessage: (input: FeedbackMessageInput) => Promise<boolean>;
  track: (event: AnalyticsEvent) => void;
};
