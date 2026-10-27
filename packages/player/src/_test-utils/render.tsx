import { render as renderInBrowser } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { type ReactNode } from "react";

/**
 * The apps' translations provider, in English: the player's messages are their own source text
 * (`useExtracted`), and dates read in the device's time zone.
 */
export function TestIntl({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider
      locale="en"
      timeZone={new Intl.DateTimeFormat().resolvedOptions().timeZone}
    >
      {children}
    </NextIntlClientProvider>
  );
}

/** Renders inside the translations provider, as the apps do. */
export function render(ui: ReactNode, options?: Parameters<typeof renderInBrowser>[1]) {
  return renderInBrowser(ui, { ...options, wrapper: TestIntl });
}
