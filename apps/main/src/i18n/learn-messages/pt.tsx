"use client";

import learn from "@zoonk/learn/messages/pt.po";
import player from "@zoonk/player/messages/pt.po";
import { NextIntlClientProvider } from "next-intl";
import app from "../../../messages/pt.po";
import { mergeMessages } from "../merge-messages";

const messages = mergeMessages(player, learn, app);

export function LearnMessagesPt({
  children,
  timeZone,
}: {
  children: React.ReactNode;
  timeZone: string;
}) {
  return (
    <NextIntlClientProvider locale="pt" messages={messages} timeZone={timeZone}>
      {children}
    </NextIntlClientProvider>
  );
}
