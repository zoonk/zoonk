import learn from "@zoonk/learn/messages/ja.po";
import player from "@zoonk/player/messages/ja.po";
import { NextIntlClientProvider } from "next-intl";
import app from "../../../messages/ja.po";
import { mergeMessages } from "../merge-messages";

const messages = mergeMessages(player, learn, app);

export function LearnMessagesJa({
  children,
  timeZone,
}: {
  children: React.ReactNode;
  timeZone: string;
}) {
  return (
    <NextIntlClientProvider locale="ja" messages={messages} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
