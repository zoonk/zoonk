"use client";

import { getRemindersSignUpHref } from "@/lib/reminders/reminders-sign-up-href";
import { updateStudyReminderAction } from "@/lib/reminders/study-reminder-actions";
import { type StudyReminderView } from "@zoonk/core/reminders/contract";
import { useAppLocale } from "@zoonk/learn/locale";
import { RemindersScreen } from "@zoonk/learn/reminders";

export function RemindersSettings({ reminder }: { reminder: StudyReminderView }) {
  const locale = useAppLocale();

  return (
    <RemindersScreen
      reminder={reminder}
      save={(change) => updateStudyReminderAction({ ...change, locale })}
      signUpHref={getRemindersSignUpHref(locale)}
    />
  );
}
