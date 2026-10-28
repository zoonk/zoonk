import { getSupportedLocaleFromLanguage } from "@zoonk/utils/locale";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getTimeZone } from "next-intl/server";
import { LearnMessages } from "./learn-messages/learn-messages";
import { getSiteMessages } from "./messages";

/**
 * Sends the browser only the messages the client components in this part of the app use: the root
 * layout wraps every page in the `site` scope (main's catalog and learn's site namespaces), and the
 * app's frame and the task screens' layouts wrap their part in `learn`, every catalog with the
 * player's. A nested provider replaces its parent's messages, so `learn` includes `site`'s.
 *
 * `learn` is a static script per locale rather than part of the page's data: the browser loads the
 * learner's locale only and keeps it between pages and visits, and no response carries it (the payload sends a page twice on a hard
 * load, and the catalog came before the page's content, delaying it on slow networks).
 */
export async function ClientMessagesProvider({
  children,
  scope,
}: {
  children: React.ReactNode;
  scope: "learn" | "site";
}) {
  const locale = await getLocale();

  if (scope === "learn") {
    // The server's provider passes the request's zone too, so dates format alike on both sides.
    const timeZone = await getTimeZone();

    return (
      <LearnMessages locale={getSupportedLocaleFromLanguage(locale)} timeZone={timeZone}>
        {children}
      </LearnMessages>
    );
  }

  return (
    <NextIntlClientProvider messages={await getSiteMessages(locale)}>
      {children}
    </NextIntlClientProvider>
  );
}
