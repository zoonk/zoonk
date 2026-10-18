"use client";

import { trackEvent } from "@zoonk/core/analytics/client";
import { type ContentFeedbackAdapters, ContentFeedbackProvider } from "@zoonk/learn/feedback";
import { safeAsync } from "@zoonk/utils/error";
import { readContentVoteAction, voteOnContentAction } from "./content-vote-action";
import { sendFeedbackRequest } from "./feedback-request";

/**
 * Guests are anonymous accounts whose email isn't theirs, so only real accounts fill the form. If
 * the session can't be read, the learner types their email. The auth client loads only when the
 * form opens, since this provider wraps every page.
 */
async function getViewerEmail(): Promise<string | null> {
  const { data: session } = await safeAsync(async () => {
    const { authClient } = await import("@zoonk/auth/client");
    return authClient.getSession();
  });

  const user = session?.data?.user;

  return user && !user.isAnonymous ? user.email : null;
}

const MAIN_FEEDBACK_ADAPTERS: ContentFeedbackAdapters = {
  getViewerEmail,
  platform: "web",
  readVote: readContentVoteAction,
  sendMessage: sendFeedbackRequest,
  track: trackEvent,
  vote: voteOnContentAction,
};

/**
 * Gives every page votes and the feedback form: messages go through the public API (the same
 * validation and quotas as native apps) and votes through core, like the rest of main.
 */
export function MainFeedbackProvider({ children }: { children: React.ReactNode }) {
  return (
    <ContentFeedbackProvider adapters={MAIN_FEEDBACK_ADAPTERS}>{children}</ContentFeedbackProvider>
  );
}
