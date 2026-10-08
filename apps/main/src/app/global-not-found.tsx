import { NotFoundMessage } from "@/components/public/not-found-message";
import { routing } from "@/i18n/routing";
import { type Metadata } from "next";
import { hasLocale } from "next-intl";
import { getExtracted } from "next-intl/server";
import { headers } from "next/headers";
import { Suspense } from "react";
import "./globals.css";

/** The locale the proxy resolved for this request (from the path, the saved choice or the browser). */
const LOCALE_HEADER = "X-NEXT-INTL-LOCALE";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getExtracted({ locale: routing.defaultLocale });
  return { robots: { follow: false, index: false }, title: t("Page not found") };
}

/** The message in the visitor's language, marked with it, since the document itself is prerendered. */
async function LocalizedMessage() {
  const requestHeaders = await headers();
  const requested = requestHeaders.get(LOCALE_HEADER);
  const locale = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;

  return (
    <main className="flex flex-1 flex-col" lang={locale}>
      <NotFoundMessage locale={locale} />
    </main>
  );
}

/**
 * URLs no route matches skip the app's layouts, so this page brings its own document: the same
 * message as the in-app 404, whose button goes home. It can't tell a visitor from a learner, so it
 * shows no bar (no logo, no account) rather than the wrong one.
 */
export default async function GlobalNotFound() {
  return (
    <html lang={routing.defaultLocale}>
      <body className="font-sans antialiased">
        <div className="flex min-h-dvh flex-col">
          <Suspense fallback={<main className="flex-1" />}>
            <LocalizedMessage />
          </Suspense>
        </div>
      </body>
    </html>
  );
}
