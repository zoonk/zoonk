import learn from "@zoonk/learn/messages/ko.po";
import player from "@zoonk/player/messages/ko.po";
import { NextIntlClientProvider } from "next-intl";
import app from "../../../messages/ko.po";
import { mergeMessages } from "../merge-messages";

const messages = mergeMessages(player, learn, app);

export function LearnMessagesKo({
  children,
  timeZone,
}: {
  children: React.ReactNode;
  timeZone: string;
}) {
  return (
    <NextIntlClientProvider locale="ko" messages={messages} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
