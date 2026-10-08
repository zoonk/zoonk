import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag } from "../../cache/tags";
import { getSession } from "../../users/get-session";

/**
 * "Not now" to inviting a guardian on Today: the offer stays put away, on every device. Settings
 * keeps the invite for whenever the learner wants it.
 */
export async function dismissGuardianInvite(): Promise<{ status: "dismissed" | "unauthorized" }> {
  const session = await getSession();

  if (!session || session.user.isAnonymous) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const now = new Date();

  await prisma.userLearningProfile.upsert({
    create: { guardianInviteDismissedAt: now, userId },
    update: { guardianInviteDismissedAt: now },
    where: { userId },
  });

  revalidateCacheTags([getLearningProfileCacheTag(userId)]);

  return { status: "dismissed" };
}
