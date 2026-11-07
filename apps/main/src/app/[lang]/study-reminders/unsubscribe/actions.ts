"use server";

import { turnOffStudyReminderEmail } from "@zoonk/core/reminders/email-unsubscribe";

export async function turnOffStudyReminderEmailAction(token: unknown): Promise<"invalid" | "off"> {
  return typeof token === "string" ? turnOffStudyReminderEmail(token) : "invalid";
}
