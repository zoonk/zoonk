import learn from "@zoonk/learn/messages/it.po";
import player from "@zoonk/player/messages/it.po";
import { NextIntlClientProvider } from "next-intl";
import app from "../../../messages/it.po";
import { mergeMessages } from "../merge-messages";

const messages = mergeMessages(player, learn, app);

export function LearnMessagesIt({
  children,
  timeZone,
}: {
  children: React.ReactNode;
  timeZone: string;
}) {
  return (
    <NextIntlClientProvider locale="it" messages={messages} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
