import { API_URL, getMainPageUrl } from "@zoonk/utils/url";

/** The email's visible link; it works without sign-in. Without a locale, Main picks the browser's. */
export function getUnsubscribePageUrl({ locale = "", token }: { locale?: string; token: string }) {
  return getMainPageUrl({
    locale,
    path: `/study-reminders/unsubscribe?token=${encodeURIComponent(token)}`,
  });
}

/** RFC 8058: mailboxes POST `List-Unsubscribe=One-Click` to the https URL; DKIM must cover both. */
export function getListUnsubscribeHeaders(token: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${API_URL}/v1/unsubscribe/study-reminders?token=${encodeURIComponent(token)}>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
