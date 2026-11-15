import { render as renderInBrowser } from "@testing-library/react";
import { getLocalTimeZone } from "@zoonk/utils/time-zone";
import { NextIntlClientProvider } from "next-intl";
import { type ReactNode } from "react";

export function TestIntl({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="en" timeZone={getLocalTimeZone()}>
      {children}
    </NextIntlClientProvider>
  );
}

export function render(ui: ReactNode, options?: Parameters<typeof renderInBrowser>[1]) {
  return renderInBrowser(ui, { ...options, wrapper: TestIntl });
}
