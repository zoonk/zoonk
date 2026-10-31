"use client";

import { NextIntlClientProvider } from "next-intl";

const NO_MESSAGES = {};

/** Without catalogs, next-intl shows each message as written in the code: the player's English. */
export function PreviewIntlProvider({ children }: React.PropsWithChildren) {
  return (
    <NextIntlClientProvider locale="en" messages={NO_MESSAGES} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}
