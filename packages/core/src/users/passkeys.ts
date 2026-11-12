import "server-only";
import { prisma } from "@zoonk/db";
import { cacheTag } from "next/cache";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getPasskeysCacheTag } from "../cache/tags";
import { isStaffAccount } from "../staff/staff-account";
import { getSession } from "./get-session";

export type PasskeyView = { createdAt: Date | null; id: string; name: string | null };

/**
 * The signed-in person's passkeys, oldest first. Null when their settings don't offer passkeys:
 * a passkey approves content fixes, so for now only staff manage them.
 */
export async function getPasskeys(): Promise<PasskeyView[] | null> {
  "use cache: private";

  const session = await getSession();

  if (!session || !isStaffAccount(session.user)) {
    return null;
  }

  cacheTag(getPasskeysCacheTag(session.user.id));

  return prisma.passkey.findMany({
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { createdAt: true, id: true, name: true },
    where: { userId: session.user.id },
  });
}

/**
 * Better Auth's passkey endpoints write from the browser, where no core write can expire the
 * list, so the page that called them asks for it to be read again.
 */
export async function expirePasskeys(): Promise<void> {
  const session = await getSession();

  if (session) {
    revalidateCacheTags([getPasskeysCacheTag(session.user.id)]);
  }
}
