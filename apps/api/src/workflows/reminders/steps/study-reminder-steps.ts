import { sendApnsReminder } from "@/lib/reminders/apns";
import { sendFcmReminder } from "@/lib/reminders/fcm";
import { type PushOutcome } from "@/lib/reminders/push-outcome";
import { loadReminderWords, writeReminderText } from "@/lib/reminders/reminder-copy";
import { type EmailOutcome, sendReminderEmail } from "@/lib/reminders/reminder-email";
import { clearStudyReminderPhone } from "@zoonk/core/reminders/clear-phone";
import { claimStudyReminder, readStudyReminderDelivery } from "@zoonk/core/reminders/send";
import { RetryableError } from "workflow";

export async function claimStudyReminderStep(userId: string) {
  "use step";

  return claimStudyReminder({ now: new Date(), userId });
}

export async function sendStudyReminderEmailStep(
  userId: string,
): Promise<EmailOutcome | "notNeeded"> {
  "use step";

  const delivery = await readStudyReminderDelivery({ channel: "email", now: new Date(), userId });

  if (delivery?.channel !== "email") {
    return "notNeeded";
  }

  const words = await loadReminderWords(delivery.locale);

  return sendReminderEmail({
    address: delivery.address,
    goalId: delivery.message.goalId,
    locale: delivery.locale,
    text: writeReminderText({ message: delivery.message, words }),
    unsubscribeToken: delivery.unsubscribeToken,
    words: words.email,
  });
}

export async function sendStudyReminderPushStep(
  userId: string,
): Promise<Exclude<PushOutcome["status"], "retry"> | "notNeeded"> {
  "use step";

  const delivery = await readStudyReminderDelivery({ channel: "push", now: new Date(), userId });

  if (delivery?.channel !== "push") {
    return "notNeeded";
  }

  const words = await loadReminderWords(delivery.locale);
  const text = writeReminderText({ message: delivery.message, words });
  const reminder = { expiresAt: delivery.expiresAt, goalId: delivery.message.goalId, text };

  const outcome =
    delivery.platform === "ios"
      ? await sendApnsReminder({ ...reminder, token: delivery.token })
      : await sendFcmReminder({ ...reminder, fid: delivery.token });

  if (outcome.status === "gone") {
    await clearStudyReminderPhone({ token: delivery.token, userId });
  }

  // The push service said it didn't deliver and asked us to wait; the retry checks the window again.
  if (outcome.status === "retry") {
    throw new RetryableError("Push service asked to retry the study reminder", {
      retryAfter: new Date(Date.now() + outcome.retryAfterMs),
    });
  }

  return outcome.status;
}
