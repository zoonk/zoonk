import "server-only";
import { prisma } from "@zoonk/db";
import { getSession } from "./get-session";

/** Requires sign-in; provider linkage is omitted from bearer sessions, so native deletion reads it separately. */
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
