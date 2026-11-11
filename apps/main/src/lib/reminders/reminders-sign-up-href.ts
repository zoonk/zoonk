import { getPathname } from "@/i18n/navigation";
import { getMenu } from "@/lib/menu";
import { type SupportedLocale } from "@zoonk/utils/locale";

/** A guest who creates an account lands on Reminders, where email is still theirs to turn on. */
export function getRemindersSignUpHref(locale: SupportedLocale): string {
  const reminders = getPathname({ href: getMenu("reminders").url, locale });
  return `${getPathname({ href: "/login", locale })}?next=${encodeURIComponent(reminders)}`;
}
