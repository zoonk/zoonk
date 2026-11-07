import "server-only";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getStudyReminderCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getSession } from "../users/get-session";
import { findDefaultReminderTime } from "./_utils/study-reminder-view";
import { type StudyReminderOfferClaimInput } from "./study-reminder-contract";

/** The offer shows once per learner: only the call that marks it shown gets `claimed: true`. */
export async function claimStudyReminderOffer(
  input: StudyReminderOfferClaimInput,
): Promise<{ claimed: boolean; status: "ready" } | { status: "unauthorized" }> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;

  const claimed = await writeLearnerChange({ userId }, async (tx) => {
    const current = await tx.studyReminder.findUnique({
      select: { offeredAt: true },
      where: { userId },
    });

    if (current?.offeredAt) {
      return unchanged(false);
    }

    const offeredAt = new Date();

    await tx.studyReminder.upsert({
      create: {
        locale: input.locale,
        offeredAt,
        time: await findDefaultReminderTime(userId),
        userId,
      },
      update: { locale: input.locale, offeredAt },
      where: { userId },
    });

    return true;
  });

  if (claimed) {
    revalidateCacheTags([getStudyReminderCacheTag(userId)]);
  }

  return { claimed, status: "ready" };
}
