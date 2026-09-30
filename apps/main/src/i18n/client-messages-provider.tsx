import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { type ClientMessagesScope, getClientMessages } from "./messages";

/**
 * Sends the browser only the messages the client components in this part of the app use: the root
 * layout wraps every page in the `site` scope, and layouts that render learn screens or the lesson
 * player wrap their part in `learn` or `player`. A nested provider replaces its parent's messages,
 * so every scope includes the smaller ones.
 */
export async function ClientMessagesProvider({
  children,
  scope,
}: {
  children: React.ReactNode;
  scope: ClientMessagesScope;
}) {
  const locale = await getLocale();
  const messages = await getClientMessages({ locale, scope });

  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
