import { getFormattingLocale } from "@zoonk/utils/locale";
import { createFormatter, useLocale, useTimeZone } from "next-intl";

type Formatter = ReturnType<typeof createFormatter>;

const formatters = new Map<string, Formatter>();

/** next-intl's own formatter formats with the route's locale, which for `es` is Spain's way. */
export function getLocaleFormatter({
  locale,
  timeZone,
}: {
  locale: string;
  timeZone?: string;
}): Formatter {
  const key = `${locale} ${timeZone ?? ""}`;
  const cached = formatters.get(key);

  if (cached) {
    return cached;
  }

  const formatter = createFormatter({ locale: getFormattingLocale(locale), timeZone });
  formatters.set(key, formatter);
  return formatter;
}

export function useFormatter(): Formatter {
  return getLocaleFormatter({ locale: useLocale(), timeZone: useTimeZone() });
}
