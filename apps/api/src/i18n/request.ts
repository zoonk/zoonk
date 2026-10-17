import { playerMessages } from "@zoonk/player/messages";
import { LOCALE_COOKIE } from "@zoonk/utils/locale";
import { getLocaleFromRequest } from "@zoonk/utils/locale-request";
import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";
import { AUTH_LOCALE_HEADER } from "./auth-locale";

export default getRequestConfig(async ({ locale: overrideLocale }) => {
  const store = await cookies();
  const headerStore = await headers();

  const cookieLocale = store.get(LOCALE_COOKIE)?.value;

  const locale = getLocaleFromRequest({
    acceptLanguage: headerStore.get("accept-language"),
    cookieLocale,
    overrideLocale: overrideLocale ?? headerStore.get(AUTH_LOCALE_HEADER),
  });

  const [translations, player] = await Promise.all([
    import(`../../messages/${locale}.po`),
    playerMessages(locale),
  ]);

  // The tutor's suggestions are worded once, in the player's catalog, for every app.
  return {
    locale,
    messages: { ...translations.default, tutorSuggestions: player.tutorSuggestions },
  };
});
