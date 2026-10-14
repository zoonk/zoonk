"use client";

import { getPathname, usePathname } from "@/i18n/navigation";
import { cn } from "@zoonk/ui/lib/utils";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { GlobeIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { Suspense } from "react";

/** Each language is a 44 px row to tap, like the footer's other links. */
const LANGUAGE_LINK_CLASS =
  "hover:text-foreground focus-visible:ring-ring/50 hit-area relative inline-flex min-h-11 items-center rounded-md outline-none transition-colors focus-visible:ring-[3px] aria-[current=true]:text-foreground aria-[current=true]:font-medium";

/**
 * Every language by its own name, each opening this page in it. A link carries its language's
 * prefix, even English's, so opening it also remembers the choice for the site's unprefixed
 * addresses, which keep sending a visitor to the language they last chose.
 */
function LanguageLinks({ pathname }: { pathname: string }) {
  const t = useExtracted();
  const current = useLocale();

  return (
    <nav aria-label={t("Language")} className="flex flex-wrap items-center gap-x-5">
      <GlobeIcon aria-hidden="true" className="size-4 shrink-0" />

      {SUPPORTED_LOCALES.map((locale) => (
        <a
          aria-current={locale === current ? "true" : undefined}
          className={cn(LANGUAGE_LINK_CLASS)}
          href={getPathname({ forcePrefix: true, href: pathname, locale })}
          hrefLang={locale}
          key={locale}
          lang={locale}
        >
          {LOCALE_LABELS[locale]}
        </a>
      ))}
    </nav>
  );
}

function CurrentPageLanguageLinks() {
  return <LanguageLinks pathname={usePathname()} />;
}

/**
 * The footer's language switch. A page that says its own path (`pathname`, without the language)
 * has it in its HTML, so a tap before scripts load opens the same page in another language; any
 * other reads it in the browser, showing each language's home page until then.
 */
export function FooterLanguages({ pathname }: { pathname?: string }) {
  if (pathname) {
    return <LanguageLinks pathname={pathname} />;
  }

  return (
    <Suspense fallback={<LanguageLinks pathname="/" />}>
      <CurrentPageLanguageLinks />
    </Suspense>
  );
}
