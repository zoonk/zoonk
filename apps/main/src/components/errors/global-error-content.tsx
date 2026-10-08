"use client";

import { buttonVariants } from "@zoonk/ui/components/button";
import { isJsonObject } from "@zoonk/utils/json";
import {
  DEFAULT_LOCALE,
  LOCALE_COOKIE,
  type SupportedLocale,
  isValidLocale,
} from "@zoonk/utils/locale";
import { NextIntlClientProvider, useExtracted } from "next-intl";
import NextError from "next/error";
import { useEffect, useState } from "react";
import { PageErrorMessage } from "./page-error-message";

type Catalog = { locale: SupportedLocale; messages: Record<string, unknown> };

/** The visitor's language: the URL's prefix, then the language they picked, then the default. */
function getVisitorLocale(): SupportedLocale {
  const [, prefix = ""] = globalThis.location.pathname.split("/");

  if (isValidLocale(prefix)) {
    return prefix;
  }

  const saved = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${LOCALE_COOKIE}=`))
    ?.slice(LOCALE_COOKIE.length + 1);

  return saved && isValidLocale(saved) ? saved : DEFAULT_LOCALE;
}

async function loadCatalog(locale: SupportedLocale): Promise<Catalog> {
  const translations: unknown = await import(`../../../messages/${locale}.po`);

  if (!isJsonObject(translations) || !isJsonObject(translations.default)) {
    throw new Error(`Could not load app messages for locale "${locale}".`);
  }

  return { locale, messages: translations.default };
}

/** Loads the visitor's catalog, then English if that fails. */
function useErrorCatalog(): Catalog | "failed" | null {
  const [catalog, setCatalog] = useState<Catalog | "failed" | null>(null);

  useEffect(() => {
    void loadCatalog(getVisitorLocale())
      .catch(() => loadCatalog(DEFAULT_LOCALE))
      .then(setCatalog, () => setCatalog("failed"));
  }, []);

  return catalog;
}

/** Home with a full page load: after the whole app failed, starting fresh is the safest way back. */
function HomeLink() {
  const t = useExtracted();

  return (
    // oxlint-disable-next-line next/no-html-link-for-pages -- The app router is what failed.
    <a className={buttonVariants({ variant: "ghost" })} href="/">
      {t("Go to the home page")}
    </a>
  );
}

/**
 * The global error page's content, in the visitor's language. It loads on demand (with only that
 * language's messages), since the global error boundary ships with every page. If no catalog
 * loads at all, the framework's own error page is the last resort.
 */
export default function GlobalErrorContent({ onRetry }: { onRetry: () => void }) {
  const catalog = useErrorCatalog();

  useEffect(() => {
    if (catalog && catalog !== "failed") {
      document.documentElement.lang = catalog.locale;
    }
  }, [catalog]);

  if (catalog === "failed") {
    return <NextError statusCode={0} />;
  }

  if (!catalog) {
    return null;
  }

  return (
    <NextIntlClientProvider locale={catalog.locale} messages={catalog.messages}>
      <PageErrorMessage homeLink={<HomeLink />} onRetry={onRetry} />
    </NextIntlClientProvider>
  );
}
