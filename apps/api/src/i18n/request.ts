import { playerMessages } from "@zoonk/player/messages";
import { getFormattingLocale, isValidLocale } from "@zoonk/utils/locale";
import { getRequestConfig } from "next-intl/server";
import { notFound } from "next/navigation";
import { locale as pageLocale } from "next/root-params";

/** Route handlers can't read root params, so they pass a supported locale (`getBrowserLocale`). */
export default getRequestConfig(async ({ locale: overrideLocale }) => {
  const locale =
    overrideLocale && isValidLocale(overrideLocale) ? overrideLocale : await pageLocale();

  if (!isValidLocale(locale)) {
    notFound();
  }

  const [translations, player] = await Promise.all([
    import(`../../messages/${locale}.po`),
    playerMessages(locale),
  ]);

  // The tutor's suggestions are worded once, in the player's catalog, for every app.
  return {
    locale: getFormattingLocale(locale),
    messages: { ...translations.default, tutorSuggestions: player.tutorSuggestions },
  };
});
