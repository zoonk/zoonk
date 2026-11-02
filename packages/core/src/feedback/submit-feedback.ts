import "server-only";
import { after } from "next/server";
import { type AnalyticsEvent } from "../analytics/events";
import { trackSystemEvent } from "../analytics/server";
import { trackLearnerEvents } from "../analytics/track-learner-event";
import { getSession } from "../users/get-session";
import { findContentProvenance } from "./_utils/content-provenance";
import { saveFeedbackMessage } from "./_utils/save-feedback-message";
import { type FeedbackContext, type FeedbackMessageInput } from "./contract";

async function getStoredContext({
  context,
  userId,
}: {
  context: FeedbackContext;
  userId: string | null;
}) {
  if (!(context.contentKind && context.contentId)) {
    return context;
  }

  const provenance = await findContentProvenance({
    contentId: context.contentId,
    contentKind: context.contentKind,
    userId,
  });

  return provenance ? { ...context, provenance } : context;
}

/** Anyone may submit; email failures are logged after storage and do not fail a saved message. */
export async function submitFeedback({ context = {}, email, message }: FeedbackMessageInput) {
  const session = await getSession();
  const userId = session?.user.id ?? null;

  const feedback = await saveFeedbackMessage({
    context: await getStoredContext({ context, userId }),
    email,
    message,
    userId,
  });

  const events: AnalyticsEvent[] = [
    { name: "Feedback Sent", properties: { content_kind: context.contentKind ?? null } },
    ...(context.contentId && context.contentKind
      ? [
          {
            name: "Content Reported" as const,
            properties: {
              content_id: context.contentId,
              content_kind: context.contentKind,
              reason: "problem",
            },
          },
        ]
      : []),
  ];

  after(async () => {
    if (userId) {
      await trackLearnerEvents({ events, userId });
      return;
    }

    await Promise.all(events.map((event) => trackSystemEvent(event)));
  });

  return feedback;
}
