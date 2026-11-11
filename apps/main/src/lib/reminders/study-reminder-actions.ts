"use server";

import { claimStudyReminderOffer } from "@zoonk/core/reminders/claim-offer";
import {
  type StudyReminderView,
  studyReminderOfferClaimSchema,
  studyReminderUpdateSchema,
} from "@zoonk/core/reminders/contract";
import { getStudyReminder } from "@zoonk/core/reminders/get";
import { updateStudyReminder } from "@zoonk/core/reminders/update";

export async function getStudyReminderAction(): Promise<StudyReminderView | null> {
  return getStudyReminder();
}

export async function claimStudyReminderOfferAction(input: unknown): Promise<boolean> {
  const parsed = studyReminderOfferClaimSchema.safeParse(input);

  if (!parsed.success) {
    return false;
  }

  const result = await claimStudyReminderOffer(parsed.data);
  return result.status === "ready" && result.claimed;
}

export async function updateStudyReminderAction(input: unknown): Promise<boolean> {
  const parsed = studyReminderUpdateSchema.safeParse(input);

  if (!parsed.success) {
    return false;
  }

  const result = await updateStudyReminder(parsed.data);
  return result.status === "updated";
}
