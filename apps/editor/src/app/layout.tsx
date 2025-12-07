import { FullPageLoading } from "@zoonk/ui/components/loading";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "next-intl/server";
import { Suspense } from "react";

import "@zoonk/ui/globals.css";

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
    template: "%s | Zoonk Editor",
  },
};

async function LayoutView({ children }: React.ComponentProps<"html">) {
  const locale = await getLocale();

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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <Suspense fallback={<FullPageLoading />}>
      <LayoutView>{children}</LayoutView>
    </Suspense>
  );
}
