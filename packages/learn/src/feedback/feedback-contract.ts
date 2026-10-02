import { type AnalyticsEvent } from "@zoonk/core/analytics/events";
import {
  type ContentVoteInput,
  type ContentVoteTarget,
  type FeedbackContext,
  type FeedbackMessageInput,
} from "@zoonk/core/feedback/contract";

export type ContentVoteValue = ContentVoteInput["vote"];
export type ContentFeedbackReason = NonNullable<ContentVoteInput["reasons"]>[number];

/** Where a message is written from; the form adds the page and platform itself. */
export type FeedbackFormContext = Pick<FeedbackContext, "contentId" | "contentKind" | "screen">;

/** A report is a message about the content on screen, from its menu's "Report a problem". */
export type FeedbackFormRequest = { context: FeedbackFormContext; isReport: boolean };

/**
 * How feedback reaches the server. The host implements these (the web app with its actions or
 * the public API, a native app with the API), so the components never know about auth or URLs.
 * Each call resolves to whether it was saved.
 */
export type ContentFeedbackAdapters = {
  /** The signed-in learner's email, to fill in the message form. Null for guests and visitors. */
  getViewerEmail: () => Promise<string | null>;
  platform: NonNullable<FeedbackContext["platform"]>;
  /** The learner's own vote, so menus and thumbs show what they picked before. */
  readVote: (target: ContentVoteTarget) => Promise<ContentVoteValue | null>;
  sendMessage: (input: FeedbackMessageInput) => Promise<boolean>;
  track: (event: AnalyticsEvent) => void;
  vote: (input: ContentVoteInput) => Promise<boolean>;
};

export function getVoteKey({ contentId, contentKind }: ContentVoteTarget): string {
  return `${contentKind}:${contentId}`;
}
