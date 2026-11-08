"use client";

import { readBrowserSession } from "@/lib/workflow/auth-headers";
import { type ContentFeedbackAdapters, ContentFeedbackProvider } from "@zoonk/learn/feedback";
import { safeAsync } from "@zoonk/utils/error";
import { sendFeedbackRequest } from "./feedback-request";

/**
 * A guest's email isn't theirs, so only real accounts fill the form. The auth client loads only when
 * the form opens, since this provider wraps every page.
 */
async function getViewerEmail(): Promise<string | null> {
  const { data: session } = await safeAsync(readBrowserSession);

  const user = session?.data?.user;

  return user && !user.isAnonymous ? user.email : null;
}

const MAIN_FEEDBACK_ADAPTERS: ContentFeedbackAdapters = {
  getViewerEmail,
  platform: "web",
  sendMessage: sendFeedbackRequest,
};

export function MainFeedbackProvider({ children }: { children: React.ReactNode }) {
  return (
    <ContentFeedbackProvider adapters={MAIN_FEEDBACK_ADAPTERS}>{children}</ContentFeedbackProvider>
  );
}
