"use client";

import { NextIntlClientProvider } from "next-intl";

const NO_MESSAGES = {};

/**
 * The player's words in English, its source language: without catalogs, next-intl shows each
 * message as written in the code.
 */
export function PreviewIntlProvider({ children }: React.PropsWithChildren) {
  return (
    <NextIntlClientProvider locale="en" messages={NO_MESSAGES} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
