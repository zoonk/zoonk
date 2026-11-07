import "server-only";
import { type StudyReminder } from "@zoonk/db";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getStudyReminderCacheTag } from "../cache/tags";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { getSession } from "../users/get-session";
import { isQuarterHour } from "./_utils/quarter-hour";
import { findDefaultReminderTime, findStudyReminderView } from "./_utils/study-reminder-view";
import { type StudyReminderUpdateInput, type StudyReminderView } from "./study-reminder-contract";

export type StudyReminderUpdateResult =
  | { reminder: StudyReminderView; status: "updated" }
  | { status: "accountRequired" | "phoneRequired" | "timeNotOnQuarterHour" | "unauthorized" };

function turnsChannelOn({
  current,
  input,
}: {
  current: StudyReminder | null;
  input: StudyReminderUpdateInput;
}): boolean {
  return Boolean((input.emailOn && !current?.emailOn) || (input.pushOn && !current?.pushOn));
}

function getReminderData({
  current,
  input,
  now,
}: {
  current: StudyReminder | null;
  input: StudyReminderUpdateInput;
  now: Date;
}) {
  return {
    locale: input.locale,
    ...(input.time !== undefined && { time: input.time }),
    ...(input.emailOn !== undefined && { emailOn: input.emailOn }),
    ...(input.pushOn !== undefined && { pushOn: input.pushOn }),
    ...(turnsChannelOn({ current, input }) && { enabledAt: now }),
  };
}

/** A language switch alone keeps a learner who never saved reminders without a row. */
function isLocaleOnly(input: StudyReminderUpdateInput): boolean {
  return input.time === undefined && input.emailOn === undefined && input.pushOn === undefined;
}

/** Omitted fields keep their saved value; only a field the learner changed is sent. */
export async function updateStudyReminder(
  input: StudyReminderUpdateInput,
): Promise<StudyReminderUpdateResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  if (input.time !== undefined && !isQuarterHour(input.time)) {
    return { status: "timeNotOnQuarterHour" };
  }

  if (input.emailOn && session.user.isAnonymous) {
    return { status: "accountRequired" };
  }

  const userId = session.user.id;
  const now = new Date();

  const outcome = await writeLearnerChange({ userId }, async (tx) => {
    const current = await tx.studyReminder.findUnique({ where: { userId } });

    if (input.pushOn && !current?.pushToken) {
      return unchanged("phoneRequired" as const);
    }

    if (!current && isLocaleOnly(input)) {
      return unchanged("updated" as const);
    }

    const data = getReminderData({ current, input, now });

    await tx.studyReminder.upsert({
      create: { time: await findDefaultReminderTime(userId), ...data, userId },
      update: data,
      where: { userId },
    });

    return "updated" as const;
  });

  if (outcome === "phoneRequired") {
    return { status: outcome };
  }

  revalidateCacheTags([getStudyReminderCacheTag(userId)]);

  return { reminder: await findStudyReminderView({ now, user: session.user }), status: "updated" };
}
