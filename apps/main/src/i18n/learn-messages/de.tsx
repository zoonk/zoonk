import learn from "@zoonk/learn/messages/de.po";
import player from "@zoonk/player/messages/de.po";
import { NextIntlClientProvider } from "next-intl";
import app from "../../../messages/de.po";
import { mergeMessages } from "../merge-messages";

const messages = mergeMessages(player, learn, app);

export function LearnMessagesDe({
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
