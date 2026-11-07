import { updateStudyReminderAction } from "@/lib/reminders/study-reminder-actions";
import { safeAsync } from "@zoonk/utils/error";
import { type SupportedLocale } from "@zoonk/utils/locale";
import { getPathname } from "./navigation";
import { rememberLocale } from "./remember-locale";

/**
 * Saved, then a document navigation: through the client router, the in-flight response can be lost
 * when the proxy canonicalizes English. The forced prefix lets the proxy send English to its
 * unprefixed URL. Reminder emails follow the new language; a failed save never blocks the switch.
 */
export async function switchLanguage({ href, locale }: { href: string; locale: SupportedLocale }) {
  rememberLocale(locale);
  await safeAsync(() => updateStudyReminderAction({ locale }));
  globalThis.location.replace(getPathname({ forcePrefix: true, href, locale }));
}
