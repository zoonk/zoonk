import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "./get-session";

/**
 * Lets native clients offer Apple reauthentication during account deletion so
 * the server can revoke a linked Sign in with Apple grant. The bearer session
 * intentionally does not expose which providers the user has linked.
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
