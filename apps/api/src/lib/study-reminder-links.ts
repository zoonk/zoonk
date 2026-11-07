import { MAIN_URL } from "@zoonk/utils/url";

/** The email's visible link; it works without sign-in. */
export function getUnsubscribePageUrl(token: string): string {
  return `${MAIN_URL}/study-reminders/unsubscribe?token=${encodeURIComponent(token)}`;
}
