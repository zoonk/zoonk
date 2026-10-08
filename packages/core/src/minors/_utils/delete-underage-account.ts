import "server-only";
import { deleteUserDependenciesBeforeAuthDelete } from "@zoonk/auth/account-deletion";
import { prisma } from "@zoonk/db";
import { trackAccountDeleted } from "../../analytics/server";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getUserSessionCacheTag } from "../../cache/tags";

/**
 * Zoonk is for 13 and older, so an account whose age answer is under 13 is deleted with everything
 * it created. The provider cleanup of a normal deletion (Stripe, Apple) runs first, so nothing is
 * left billing, and PostHog is told, so the learner's analytics go too. Clients sign the learner out
 * after this.
 */
export async function deleteUnderageAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });

  if (!user) {
    return;
  }

  await deleteUserDependenciesBeforeAuthDelete(user);
  await prisma.user.delete({ where: { id: userId } });
  await trackAccountDeleted({ analyticsDisabled: user.analyticsDisabled, userId });

  revalidateCacheTags([getUserSessionCacheTag(userId)]);
}
