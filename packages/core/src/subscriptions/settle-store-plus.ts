import "server-only";
import { sendPlusTwiceEmail } from "@zoonk/auth/duplicate-plus-emails";
import { endWebPlusBesideStorePlus } from "@zoonk/auth/settle-web-plus";
import { prisma } from "@zoonk/db";

/**
 * Settles what a store save owed (`endWebPlusBesideStore`, `askToCancelSecondStorePlus`). Workflow
 * bridges pass the store chain's owner.
 */
export async function endWebPlusBesideStore(userId: string): Promise<void> {
  await endWebPlusBesideStorePlus({ userId });
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
