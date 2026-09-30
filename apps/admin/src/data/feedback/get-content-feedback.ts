import "server-only";
import { cacheAdminData } from "@/data/_utils/admin-data-cache";
import { prisma } from "@zoonk/db";
import { findContentFeedbackHrefs, toContentKey } from "./_utils/content-feedback-hrefs";

/** One vote with every stored field, including the comment the detail page keeps collapsed. */
export const getContentFeedback = cacheAdminData(async (id: string) => {
  const feedback = await prisma.contentFeedback.findUnique({
    include: { user: { select: { email: true, id: true, name: true, username: true } } },
    where: { id },
  });

  if (!feedback) {
    return null;
  }

  const hrefs = await findContentFeedbackHrefs([feedback]);

  return { ...feedback, contentHref: hrefs.get(toContentKey(feedback)) ?? null };
});
