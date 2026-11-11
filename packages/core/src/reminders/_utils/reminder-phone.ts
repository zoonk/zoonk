import { type Session, type StudyReminder } from "@zoonk/db";
import { type StudyReminderView } from "../study-reminder-contract";

export function getReminderPhone({
  now,
  reminder,
}: {
  now: Date;
  reminder: (StudyReminder & { pushSession: Pick<Session, "expiresAt"> | null }) | null;
}): StudyReminderView["push"]["phone"] {
  if (
    !reminder?.pushToken ||
    !reminder.pushPlatform ||
    !reminder.pushLabel ||
    !reminder.pushSession ||
    reminder.pushSession.expiresAt <= now
  ) {
    return null;
  }

  return { label: reminder.pushLabel, platform: reminder.pushPlatform, token: reminder.pushToken };
}
