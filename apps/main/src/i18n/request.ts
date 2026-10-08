import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { getAllMessages } from "./messages";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale: overrideLocale }) => {
  const locale = hasLocale(routing.locales, overrideLocale) ? overrideLocale : await lang();

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  return { locale, messages: await getAllMessages(locale) };
});
