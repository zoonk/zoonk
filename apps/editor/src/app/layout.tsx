import { Toaster } from "@zoonk/ui/components/sonner";
import { type Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import "@zoonk/ui/globals.css";
import { getLocale } from "next-intl/server";

export const metadata: Metadata = {
  metadataBase: new URL("https://editor.zoonk.com"),
  title: {
    default: "Zoonk Editor",
    template: "%s | Editor",
  },
};

export default async function LocaleLayout({ children }: LayoutProps<"/">) {
  const locale = await getLocale();

  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <Toaster />
      </body>
    </html>
  );
}
