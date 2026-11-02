import learn from "@zoonk/learn/messages/fr.po";
import player from "@zoonk/player/messages/fr.po";
import { NextIntlClientProvider } from "next-intl";
import app from "../../../messages/fr.po";
import { mergeMessages } from "../merge-messages";

const messages = mergeMessages(player, learn, app);

export function LearnMessagesFr({
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
