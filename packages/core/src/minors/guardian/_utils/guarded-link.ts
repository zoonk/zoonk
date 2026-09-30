import "server-only";
import { prisma } from "@zoonk/db";
import { getSignedInGuardianEmail } from "./signed-in-account";

/** Finds an active link the signed-in guardian owns; anyone else gets nothing. */
export async function findGuardedLink(linkId: string) {
  const guardianEmail = await getSignedInGuardianEmail();

  if (!guardianEmail) {
    return { link: null, signedIn: false };
  }

  const link = await prisma.guardianLink.findFirst({
    where: { guardianEmail, id: linkId, status: "active" },
  });

  return { link, signedIn: true };
}
