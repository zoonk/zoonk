import "server-only";
import { prisma } from "@zoonk/db";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";

/** Retain the deleted account's analytics id for manual removal; logging failure must not fail account deletion. */
export async function logAccountDeletion(userId: string) {
  const { error } = await safeAsync(() => prisma.accountDeletion.create({ data: { userId } }));

  if (error) {
    logError("Couldn't log the account deletion; remove its analytics by hand:", userId, error);
  }
}
