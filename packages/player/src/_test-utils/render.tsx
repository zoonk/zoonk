import { render as renderInBrowser } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { type ReactNode } from "react";

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

export function render(ui: ReactNode, options?: Parameters<typeof renderInBrowser>[1]) {
  return renderInBrowser(ui, { ...options, wrapper: TestIntl });
}
