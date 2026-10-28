"use client";

import learn from "@zoonk/learn/messages/es.po";
import player from "@zoonk/player/messages/es.po";
import { NextIntlClientProvider } from "next-intl";
import app from "../../../messages/es.po";
import { mergeMessages } from "../merge-messages";

const messages = mergeMessages(player, learn, app);

export function LearnMessagesEs({
  children,
  timeZone,
}: {
  children: React.ReactNode;
  timeZone: string;
}) {
  return (
    <NextIntlClientProvider locale="es" messages={messages} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
