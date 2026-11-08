import "server-only";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getStudyReminderCacheTag } from "../cache/tags";
import { writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getSession } from "../users/get-session";
import { getReminderPhone } from "./_utils/reminder-phone";
import { findDefaultReminderTime, findStudyReminderView } from "./_utils/study-reminder-view";
import { NO_PHONE } from "./clear-study-reminder-phone";
import { type StudyReminderPhoneInput, type StudyReminderView } from "./study-reminder-contract";

type PhoneResult = { reminder: StudyReminderView; status: "ready" } | { status: "unauthorized" };

/**
 * Makes this phone the one push goes to, or refreshes its token. A device token belongs to one
 * learner at a time, so another account signed in on it before loses it.
 */
export async function selectStudyReminderPhone(
  input: StudyReminderPhoneInput,
): Promise<PhoneResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const userId = session.user.id;
  const now = new Date();

  const phone = {
    pushLabel: input.label,
    pushPlatform: input.platform,
    pushSessionId: session.session.id,
    pushToken: input.token,
  };

  const previousOwners = await writeLearnerChange({ userId }, async (tx) => {
    const current = await tx.studyReminder.findUnique({
      include: { pushSession: { select: { expiresAt: true } } },
      where: { userId },
    });

    const owners = await tx.studyReminder.updateManyAndReturn({
      data: NO_PHONE,
      select: { userId: true },
      where: { pushToken: input.token, userId: { not: userId } },
    });

    await tx.studyReminder.upsert({
      create: {
        ...phone,
        locale: input.locale,
        time: await findDefaultReminderTime(userId),
        userId,
      },
      update: {
        ...phone,
        locale: input.locale,
        ...(current?.pushOn && !getReminderPhone({ now, reminder: current }) && { enabledAt: now }),
      },
      where: { userId },
    });

    return owners.map((owner) => owner.userId);
  });

  revalidateCacheTags([userId, ...previousOwners].map((id) => getStudyReminderCacheTag(id)));

  return { reminder: await findStudyReminderView({ now, user: session.user }), status: "ready" };
}
