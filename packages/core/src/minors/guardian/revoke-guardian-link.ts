import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag } from "../../cache/tags";
import { getSignedInAccount } from "./_utils/signed-in-account";

/**
 * A learner can cancel an invite that's still pending, and a guardian can end an active link.
 * Learners can't remove an active guardian's controls on their own.
 */
export async function revokeGuardianLink({
  linkId,
}: {
  linkId: string;
}): Promise<{ status: "notFound" | "revoked" | "unauthorized" }> {
  const account = await getSignedInAccount();

  if (!account || account.isAnonymous) {
    return { status: "unauthorized" };
  }

  const asGuardian = account.emailVerified
    ? [{ guardianEmail: account.email, status: "active" as const }]
    : [];

  const link = await prisma.guardianLink.findFirst({
    where: { OR: [{ status: "pending", userId: account.id }, ...asGuardian], id: linkId },
  });

  if (!link) {
    return { status: "notFound" };
  }

  await prisma.guardianLink.update({ data: { status: "revoked" }, where: { id: link.id } });
  revalidateCacheTags([getLearningProfileCacheTag(link.userId)]);

  return { status: "revoked" };
}
