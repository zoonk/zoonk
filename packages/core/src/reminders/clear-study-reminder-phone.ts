import "server-only";
import { prisma } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getStudyReminderCacheTag } from "../cache/tags";

export const NO_PHONE = {
  pushLabel: null,
  pushOn: false,
  pushPlatform: null,
  pushSessionId: null,
  pushToken: null,
};

/** Clears the phone only while it's still `token`, so a phone selected since stays. */
export async function clearStudyReminderPhone({
  token,
  userId,
}: {
  token: string;
  userId: string;
}): Promise<void> {
  const cleared = await prisma.studyReminder.updateMany({
    data: NO_PHONE,
    where: { pushToken: token, userId },
  });

  if (cleared.count > 0) {
    revalidateCacheTags([getStudyReminderCacheTag(userId)]);
  }
}
