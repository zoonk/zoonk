import "server-only";
import {
  type EndedWebPlus,
  sendPlusTwiceEmail,
  sendWebPlusEndedEmail,
} from "@zoonk/auth/duplicate-plus-emails";
import { endWebPlusBesideStorePlus } from "@zoonk/auth/settle-web-plus";
import { prisma } from "@zoonk/db";

export type { EndedWebPlus } from "@zoonk/auth/duplicate-plus-emails";

/**
 * Settles what a store save owed (`endWebPlusBesideStore`, `askToCancelSecondStorePlus`). Workflow
 * bridges pass the store chain's owner. Ending and telling are separate, so a failed email is sent
 * again without ending anything twice.
 */
export function endWebPlusBesideStore(userId: string): Promise<EndedWebPlus[]> {
  return endWebPlusBesideStorePlus(userId);
}

export function tellWebPlusEnded(notice: EndedWebPlus): Promise<void> {
  return sendWebPlusEndedEmail(notice);
}

export async function askToCancelSecondStorePlus({
  locale,
  store,
  userId,
}: {
  locale: string;
  store: "apple" | "google";
  userId: string;
}): Promise<void> {
  const user = await prisma.user.findUnique({ select: { email: true }, where: { id: userId } });

  if (user) {
    await sendPlusTwiceEmail({ email: user.email, locale, store });
  }
}
