"use client";

import { useAppLocale } from "@zoonk/learn/locale";
import { getRemindersSignUpHref } from "./reminders-sign-up-href";
import {
  claimStudyReminderOfferAction,
  getStudyReminderAction,
  updateStudyReminderAction,
} from "./study-reminder-actions";

export function useReminderOfferActions() {
  const locale = useAppLocale();

  return {
    claim: () => claimStudyReminderOfferAction({ locale }),
    load: getStudyReminderAction,
    remindByEmail: (time: string) => updateStudyReminderAction({ emailOn: true, locale, time }),
    signUpHref: getRemindersSignUpHref(locale),
  };
}
