import { playerMessages } from "@zoonk/player/messages";
import { LOCALE_COOKIE, getLocaleFromRequest } from "@zoonk/utils/locale";
import { getRequestConfig } from "next-intl/server";
import { cookies, headers } from "next/headers";

export default getRequestConfig(async ({ locale: overrideLocale }) => {
  const store = await cookies();
  const headerStore = await headers();

  const locale = getLocaleFromRequest({
    acceptLanguage: headerStore.get("accept-language"),
    cookieLocale: store.get(LOCALE_COOKIE)?.value,
    overrideLocale,
  });

  const [playerTranslations, appTranslations] = await Promise.all([
    playerMessages(locale),
    import(`../../messages/${locale}.po`),
  ]);

  return { locale, messages: { ...playerTranslations, ...appTranslations.default } };
});
