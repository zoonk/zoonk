"use client";

import { getPathname, usePathname } from "@/i18n/navigation";
import { rememberLocale } from "@/i18n/remember-locale";
import { cn } from "@zoonk/ui/lib/utils";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { GlobeIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { Suspense } from "react";

const MIDDLE_BUTTON = 1;

const LANGUAGE_LINK_CLASS =
  "hover:text-foreground focus-visible:ring-ring/50 hit-area relative inline-flex min-h-11 items-center rounded-md outline-none transition-colors focus-visible:ring-[3px] aria-[current=true]:text-foreground aria-[current=true]:font-medium";

/**
 * A pick saves the choice (`rememberLocale`), a middle click included. English is unprefixed, so
 * `/en/…` only leads there: a pick that can't save (without scripts) opens the saved language.
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
          onAuxClick={(event) => {
            if (event.button === MIDDLE_BUTTON) {
              rememberLocale(locale);
            }
          }}
          onClick={() => rememberLocale(locale)}
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

/** With `pathname` the links are in the HTML, so a tap before scripts load opens the same page. */
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
