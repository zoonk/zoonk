import { getAppLocale } from "@/i18n/locale";
import { NextIntlClientProvider } from "next-intl";
import { LearnMessages } from "./learn-messages/learn-messages";
import { getSiteMessages } from "./messages";

/**
 * A nested provider replaces its parent's messages, so `learn` includes `site`'s. `learn` is a static
 * script per locale, not page data, so the browser keeps it between pages and no response carries it.
 */
export async function ClientMessagesProvider({
  children,
  scope,
}: {
  children: React.ReactNode;
  scope: "learn" | "site";
}) {
  const locale = await getAppLocale();

  if (scope === "learn") {
    return <LearnMessages locale={locale}>{children}</LearnMessages>;
  }

  return (
    <NextIntlClientProvider messages={await getSiteMessages(locale)}>
      {children}
    </NextIntlClientProvider>
  );
}
