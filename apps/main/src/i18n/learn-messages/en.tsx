"use client";

import learn from "@zoonk/learn/messages/en.po";
import player from "@zoonk/player/messages/en.po";
import { NextIntlClientProvider } from "next-intl";
import app from "../../../messages/en.po";
import { mergeMessages } from "../merge-messages";

const messages = mergeMessages(player, learn, app);

export function LearnMessagesEn({
  children,
  timeZone,
}: {
  children: React.ReactNode;
  timeZone: string;
}) {
  return (
    <NextIntlClientProvider locale="en" messages={messages} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
