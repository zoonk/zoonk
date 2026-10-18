import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { findContentFeedbackHrefs, toContentKey } from "./_utils/content-feedback-hrefs";
import { parseFeedbackMessageContext } from "./_utils/feedback-message-context";

/** One form message with its parsed context and the admin page of the content it was about. */
export const getFeedbackMessage = cacheAdminData(async (id: string) => {
  const feedback = await prisma.feedback.findUnique({
    include: { user: { select: { email: true, id: true, name: true, username: true } } },
    where: { id },
  });

  if (!feedback) {
    return null;
  }

  const context = parseFeedbackMessageContext(feedback.context);
  const { contentId, contentKind } = context;
  const content = contentId && contentKind ? { contentId, contentKind } : null;
  const hrefs = content ? await findContentFeedbackHrefs([content]) : new Map<string, string>();

  return {
    ...feedback,
    contentHref: content ? (hrefs.get(toContentKey(content)) ?? null) : null,
    context,
  };
});
