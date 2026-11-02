import learn from "@zoonk/learn/messages/pl.po";
import player from "@zoonk/player/messages/pl.po";
import { NextIntlClientProvider } from "next-intl";
import app from "../../../messages/pl.po";
import { mergeMessages } from "../merge-messages";

const messages = mergeMessages(player, learn, app);

export function LearnMessagesPl({
  children,
  timeZone,
}: {
  children: React.ReactNode;
  timeZone: string;
}) {
  return (
    <NextIntlClientProvider locale="pl" messages={messages} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
