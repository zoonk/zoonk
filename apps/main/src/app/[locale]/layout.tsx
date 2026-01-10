import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { NuqsAdapter } from "nuqs/adapters/next/app";
import { routing } from "@/i18n/routing";

import "@zoonk/ui/globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://zoonk.com"),
  title: {
    default: "",
    template: "%s | Zoonk",
  },
};

export async function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className="font-sans antialiased">
        <NuqsAdapter>
          <NextIntlClientProvider>{children}</NextIntlClientProvider>
        </NuqsAdapter>
        <Analytics />
      </body>
    </html>
  );
}
