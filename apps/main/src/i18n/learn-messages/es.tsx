import learn from "@zoonk/learn/messages/es.po";
import player from "@zoonk/player/messages/es.po";
import { NextIntlClientProvider } from "next-intl";
import app from "../../../messages/es.po";
import { mergeMessages } from "../merge-messages";

const messages = mergeMessages(player, learn, app);

export function LearnMessagesEs({
  children,
  locale,
  timeZone,
}: {
  children: React.ReactNode;
  locale: string;
  timeZone: string;
}) {
  return (
    <NextIntlClientProvider locale={locale} messages={messages} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
