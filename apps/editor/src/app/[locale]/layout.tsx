import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { hasLocale, NextIntlClientProvider } from "next-intl";
import { setRequestLocale } from "next-intl/server";

import "@zoonk/ui/globals.css";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

const geistSans = Geist({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
  display: "swap",
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  metadataBase: new URL("https://zoonk.com"),
  title: {
    default: "Zoonk Editor",
    template: "%s | Editor",
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
      <body
        className={`font-sans antialiased ${geistSans.variable} ${geistMono.variable}`}
      >
        <NextIntlClientProvider>{children}</NextIntlClientProvider>
      </body>
    </html>
  );
}
