import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "./get-session";

/**
 * Tells authenticated clients whether the current user has linked an Apple
 * account. The user ID always comes from the trusted session because callers
 * must not choose which account's provider state is inspected.
 */
export async function getCurrentUserHasAppleAccount() {
  const session = await getSession();

  if (!session) {
    return null;
  }

  const appleAccountCount = await prisma.account.count({
    where: { providerId: "apple", userId: session.user.id },
  });

  return appleAccountCount > 0;
}
