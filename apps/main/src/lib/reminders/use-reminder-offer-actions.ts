"use client";

import { useAppLocale } from "@zoonk/learn/locale";
import { getRemindersSignUpHref } from "./reminders-sign-up-href";
import { claimStudyReminderOfferAction, updateStudyReminderAction } from "./study-reminder-actions";

export function useReminderOfferActions() {
  const locale = useAppLocale();

  return {
    claim: () => claimStudyReminderOfferAction({ locale }),
    remindByEmail: (time: string) => updateStudyReminderAction({ emailOn: true, locale, time }),
    signUpHref: getRemindersSignUpHref(locale),
  };
}
