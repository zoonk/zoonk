import { PublicNotFound } from "@/components/public/public-not-found";
import { ClientMessagesProvider } from "@/i18n/client-messages-provider";
import { LOCALE_HEADER, routing } from "@/i18n/routing";
import { FONT_VARIABLES } from "@zoonk/ui/fonts";
import { type Metadata } from "next";
import { hasLocale } from "next-intl";
import { getExtracted } from "next-intl/server";
import { headers } from "next/headers";
import { Suspense } from "react";
import { LearnerSummarySync } from "./[lang]/learner-summary-sync";
import { SignedInHintScript } from "./[lang]/signed-in-hint-script";
import { UsageNoticeScript } from "./[lang]/usage-notice-script";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted({ locale: routing.defaultLocale });
  return { robots: { follow: false, index: false }, title: t("Page not found") };
}

async function LocalizedNotFound() {
  const requestHeaders = await headers();
  const requested = requestHeaders.get(LOCALE_HEADER);
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return (
    <ClientMessagesProvider scope="site">
      <div className="contents" lang={locale}>
        <PublicNotFound />
      </div>
    </ClientMessagesProvider>
  );
}

export default function GlobalNotFound() {
  return (
    <html className={FONT_VARIABLES} lang={routing.defaultLocale} suppressHydrationWarning>
      <head>
        <SignedInHintScript />
        <UsageNoticeScript />
      </head>
      <body className="font-sans antialiased">
        <Suspense fallback={<div className="min-h-dvh" />}>
          <LocalizedNotFound />
        </Suspense>
        <LearnerSummarySync />
      </body>
    </html>
  );
}
