"use cache";

import { Analytics } from "@vercel/analytics/next";
import type { Metadata } from "next";
import {
  unstable_cacheLife as cacheLife,
  unstable_cacheTag as cacheTag,
} from "next/cache";
import { notFound } from "next/navigation";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";
import { routing } from "@/i18n/routing";

import "../globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://zoonk.com"),
  title: {
    template: "%s | Zoonk",
    default: "",
  },
};

export async function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default async function RootLayout({
  children,
  params,
}: LayoutProps<"/[locale]">) {
  cacheLife("max");
  cacheTag("root-layout");

  const { locale } = await params;

  if (!hasLocale(routing.locales, locale)) {
    notFound();
  }

  setRequestLocale(locale);

  return (
    <html lang={locale}>
      <body className="antialiased">
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
        <Analytics />
      </body>
    </html>
  );
}
