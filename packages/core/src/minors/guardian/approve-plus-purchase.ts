import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag } from "../../cache/tags";
import { findGuardedLink } from "./_utils/guarded-link";

/**
 * The guardian approves a Plus subscription for the learner, who can then check out. The approval
 * lasts while the link stays active.
 */
export async function approvePlusPurchase({
  linkId,
}: {
  linkId: string;
}): Promise<{ status: "approved" | "notFound" | "unauthorized" }> {
  const { link, signedIn } = await findGuardedLink(linkId);

  if (!signedIn) {
    return { status: "unauthorized" };
  }

  if (!link) {
    return { status: "notFound" };
  }

  await prisma.guardianLink.update({
    data: { plusApprovedAt: link.plusApprovedAt ?? new Date() },
    where: { id: link.id },
  });

  revalidateCacheTags([getLearningProfileCacheTag(link.userId)]);

  return { status: "approved" };
}
