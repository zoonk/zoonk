import learn from "@zoonk/learn/messages/pt.po";
import player from "@zoonk/player/messages/pt.po";
import { NextIntlClientProvider } from "next-intl";
import app from "../../../messages/pt.po";
import { mergeMessages } from "../merge-messages";

const messages = mergeMessages(player, learn, app);

export function LearnMessagesPt({
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
