import { ZoonkLogo } from "@/components/brand/zoonk-logo";
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
 * URLs no route matches skip the app's layouts, so this page brings its own document: the brain
 * linking home and the same message as the in-app 404.
 */
export default async function GlobalNotFound() {
  const t = await getExtracted({ locale: routing.defaultLocale });

  return (
    <html lang={routing.defaultLocale}>
      <body className="font-sans antialiased">
        <div className="flex min-h-dvh flex-col">
          <header className="mx-auto flex h-14 w-full max-w-6xl items-center px-4 sm:h-[72px] sm:px-8">
            {/* oxlint-disable-next-line next/no-html-link-for-pages -- This document has no app router to navigate with. */}
            <a
              className="focus-visible:ring-ring/50 -m-2 rounded-xl p-2 outline-none focus-visible:ring-[3px]"
              href="/"
            >
              <ZoonkLogo className="size-7" label={t("Zoonk home page")} />
            </a>
          </header>

          <Suspense fallback={<main className="flex-1" />}>
            <LocalizedMessage />
          </Suspense>
        </div>
      </body>
    </html>
  );
}
