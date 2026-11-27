"use client";

import { getPathname, usePathname } from "@/i18n/navigation";
import { rememberLocale } from "@/i18n/remember-locale";
import { useAppLocale } from "@zoonk/learn/locale";
import { cn } from "@zoonk/ui/lib/utils";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { GlobeIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { Suspense } from "react";
import { FOOTER_LINKS_CLASS, FOOTER_LINK_CLASS } from "./landing-styles";

const MIDDLE_BUTTON = 1;

const LANGUAGE_LINK_CLASS = cn(
  FOOTER_LINK_CLASS,
  "aria-current:text-foreground aria-current:font-medium",
);

/**
 * A pick saves the choice (`rememberLocale`), a middle click included. English is unprefixed, so
 * `/en/…` only leads there: a pick that can't save (without scripts) opens the saved language.
 */
function LanguageLinks({ pathname }: { pathname: string }) {
  const t = useExtracted();
  const current = useAppLocale();

  return (
    <nav aria-label={t("Language")} className="col-span-2 grid grid-cols-subgrid">
      <span className="flex h-11 items-center justify-center">
        <GlobeIcon aria-hidden="true" className="size-4" />
      </span>

      <span className={FOOTER_LINKS_CLASS}>
        {SUPPORTED_LOCALES.map((locale) => (
          <a
            aria-current={locale === current ? "true" : undefined}
            className={LANGUAGE_LINK_CLASS}
            href={getPathname({ forcePrefix: true, href: pathname, locale })}
            hrefLang={locale}
            key={locale}
            lang={locale}
            onAuxClick={(event) => {
              if (event.button === MIDDLE_BUTTON) {
                rememberLocale(locale);
              }
            }}
            // oxlint-disable-next-line zoonk/held-press-control -- The link keeps native navigation, including modified clicks and opening in a new tab.
            onClick={() => rememberLocale(locale)}
          >
            {LOCALE_LABELS[locale]}
          </a>
        ))}
      </span>
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
