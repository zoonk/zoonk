import type { Formats } from "next-intl";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;

  const locale = hasLocale(routing.locales, requested)
    ? requested
    : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.po`)).default,
  };
});

export const formats = {
  dateTime: {
    short: {
      day: "numeric",
      month: "short",
      year: "numeric",
    },
  },
  list: {
    enumeration: {
      style: "long",
      type: "conjunction",
    },
  },
  number: {
    precise: {
      maximumFractionDigits: 5,
    },
  },
} satisfies Formats;
