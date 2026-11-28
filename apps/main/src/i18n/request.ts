import { getFormattingLocale } from "@zoonk/utils/locale";
import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { lang } from "next/root-params";
import { getAllMessages } from "./messages";
import { LOCALE_HEADER, routing } from "./routing";

/** The global not-found page has no `[lang]`, so it reads the proxy's header instead. */
async function getRouteLocale(): Promise<string> {
  const fromRoute = await lang();

  if (fromRoute) {
    return fromRoute;
  }

  const requestHeaders = await headers();
  return requestHeaders.get(LOCALE_HEADER) ?? routing.defaultLocale;
}

export default getRequestConfig(async ({ locale: overrideLocale }) => {
  const locale = hasLocale(routing.locales, overrideLocale)
    ? overrideLocale
    : await getRouteLocale();

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  // Every learner date names its zone; anything left unzoned draws alike on the server and in the browser.
  return {
    locale: getFormattingLocale(locale),
    messages: await getAllMessages(locale),
    timeZone: "UTC",
  };
});
