import learn from "@zoonk/learn/messages/en.po";
import player from "@zoonk/player/messages/en.po";
import { NextIntlClientProvider } from "next-intl";
import app from "../../../messages/en.po";
import { mergeMessages } from "../merge-messages";

const messages = mergeMessages(player, learn, app);

export function LearnMessagesEn({
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
