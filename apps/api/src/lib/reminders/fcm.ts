import { hasFirebaseServiceAccount, sendFirebaseMessage } from "@zoonk/auth/google-service-account";
import { getEnvironment } from "@zoonk/utils/environment";
import { safeAsync } from "@zoonk/utils/error";
import { logError } from "@zoonk/utils/logger";
import { type PushOutcome, classifyFcmAnswer } from "./push-outcome";
import { type ReminderText } from "./reminder-copy";

const MS_PER_SECOND = 1000;

/** The Android app registers a Firebase Installation ID, which FCM v1 targets as `fid`. */
export async function sendFcmReminder({
  expiresAt,
  fid,
  goalId,
  text,
}: {
  expiresAt: Date;
  fid: string;
  goalId: string;
  text: ReminderText;
}): Promise<PushOutcome> {
  if (!hasFirebaseServiceAccount()) {
    if (getEnvironment() === "production") {
      logError("FCM isn't configured, so Android study reminders aren't sent.");
    }

    return { status: "skipped" };
  }

  const ttlSeconds = Math.max(0, Math.floor((expiresAt.getTime() - Date.now()) / MS_PER_SECOND));

  const { data: response, error } = await safeAsync(() =>
    sendFirebaseMessage({
      android: {
        notification: { channel_id: "study_reminders", tag: "study-reminder" },
        ttl: `${ttlSeconds}s`,
      },
      data: { goalId, type: "study_reminder" },
      fid,
      notification: text,
    }),
  );

  if (error) {
    logError("FCM study reminder failed", error);
    return { status: "unknown" };
  }

  await response.body?.cancel();

  return classifyFcmAnswer({
    retryAfter: response.headers.get("Retry-After"),
    status: response.status,
  });
}
