import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearningProfileCacheTag } from "../../cache/tags";
import { hashGuardianToken } from "./_utils/guardian-token";
import { getSignedInAccount } from "./_utils/signed-in-account";

export type AcceptGuardianInviteResult =
  | { learnerName: string; linkId: string; status: "accepted" }
  | { status: "emailNotVerified" | "expired" | "notFound" | "unauthorized" | "wrongAccount" };

/**
 * The guardian accepts from the invite link while signed in with the invited address, which proves
 * they own it. Accepting twice is harmless.
 */
export async function acceptGuardianInvite({
  token,
}: {
  token: string;
}): Promise<AcceptGuardianInviteResult> {
  const account = await getSignedInAccount();

  if (!account || account.isAnonymous) {
    return { status: "unauthorized" };
  }

  if (!account.emailVerified) {
    return { status: "emailNotVerified" };
  }

  const link = await prisma.guardianLink.findUnique({
    include: { user: { select: { name: true } } },
    where: { tokenHash: hashGuardianToken(token) },
  });

  if (!link || link.status === "revoked" || link.userId === account.id) {
    return { status: "notFound" };
  }

  if (link.guardianEmail !== account.email) {
    return { status: "wrongAccount" };
  }

  const now = new Date();

  if (link.status === "pending" && link.expiresAt && link.expiresAt <= now) {
    return { status: "expired" };
  }

  await prisma.guardianLink.updateMany({
    data: { acceptedAt: now, status: "active" },
    where: { id: link.id, status: "pending" },
  });

  revalidateCacheTags([getLearningProfileCacheTag(link.userId)]);

  return { learnerName: link.user.name, linkId: link.id, status: "accepted" };
}
