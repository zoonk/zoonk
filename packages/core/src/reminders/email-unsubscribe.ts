import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@zoonk/db";
import { isLocalhostSupported } from "@zoonk/utils/environment";
import { uuidSchema } from "@zoonk/utils/uuid-schema";
import { revalidateCacheTags } from "../cache/revalidate-cache-tags";
import { getStudyReminderCacheTag } from "../cache/tags";

const PURPOSE = "study-reminder-email-unsubscribe";

/** Local runs and tests share this, so links survive restarts; deployments set their own. */
const LOCAL_SECRET = "zoonk-local-study-reminder-unsubscribe";

function getSecret(): string {
  const secret =
    process.env.STUDY_REMINDER_UNSUBSCRIBE_SECRET ||
    (isLocalhostSupported() ? LOCAL_SECRET : undefined);

  if (!secret) {
    throw new Error("STUDY_REMINDER_UNSUBSCRIBE_SECRET is missing");
  }

  return secret;
}

function sign(userId: string): Buffer {
  return createHmac("sha256", getSecret()).update(`${PURPOSE}:${userId}`).digest();
}

/**
 * The token can only turn the account's email reminders off, with no sign-in and no expiry, so an
 * old email still unsubscribes.
 */
export function signStudyReminderUnsubscribeToken(userId: string): string {
  return `${userId}.${sign(userId).toString("base64url")}`;
}

function verifyToken(token: string): string | null {
  const [id, signature, ...rest] = token.split(".");
  const userId = uuidSchema().safeParse(id).data;

  if (!userId || !signature || rest.length > 0) {
    return null;
  }

  const expected = sign(userId);
  const given = Buffer.from(signature, "base64url");

  return given.length === expected.length && timingSafeEqual(given, expected) ? userId : null;
}

/** Idempotent; reveals nothing about the account beyond whether the token is valid. */
export async function turnOffStudyReminderEmail(token: string): Promise<"invalid" | "off"> {
  const userId = verifyToken(token);

  if (!userId) {
    return "invalid";
  }

  const updated = await prisma.studyReminder.updateMany({
    data: { emailOn: false },
    where: { emailOn: true, userId },
  });

  if (updated.count > 0) {
    revalidateCacheTags([getStudyReminderCacheTag(userId)]);
  }

  return "off";
}
