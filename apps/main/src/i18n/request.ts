import { playerMessages } from "@zoonk/player/messages";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale: overrideLocale }) => {
  const locale = hasLocale(routing.locales, overrideLocale) ? overrideLocale : await lang();

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  const [playerTranslations, appTranslations] = await Promise.all([
    playerMessages(locale),
    import(`../../messages/${locale}.po`),
  ]);

  return { locale, messages: { ...playerTranslations, ...appTranslations.default } };
});
