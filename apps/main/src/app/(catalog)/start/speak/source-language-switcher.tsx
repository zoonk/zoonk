"use client";

import { Button } from "@zoonk/ui/components/button";
import { setCookie } from "@zoonk/utils/cookies";
import {
  LOCALE_COOKIE,
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type SupportedLocale,
} from "@zoonk/utils/locale";
import { useExtracted, useLocale } from "next-intl";
import { useTransition } from "react";

/**
 * Stores the selected app language before refreshing so the language-course
 * picker updates both its UI copy and the learner-language used for generation.
 */
async function setSourceLanguage(locale: SupportedLocale): Promise<void> {
  await setCookie(LOCALE_COOKIE, locale, { expires: 365, sameSite: "lax" });
  globalThis.location.reload();
}

/**
 * Lets learners choose the language they want explanations in without leaving
 * the language-start flow for the full settings page.
 */
export function SourceLanguageSwitcher() {
  const t = useExtracted();
  const currentLocale = useLocale();
  const [isPending, startTransition] = useTransition();

  function handleLocaleSelect(locale: SupportedLocale) {
    if (locale === currentLocale) {
      return;
    }

    startTransition(() => {
      void setSourceLanguage(locale);
    });
  }

  return (
    <section
      aria-label={t("Choose the language you learn from")}
      className="border-border/40 bg-muted/20 flex flex-col items-center gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:justify-center sm:gap-4"
    >
      <p className="text-muted-foreground text-sm">{t("You'll learn from")}</p>

      <div className="flex flex-wrap justify-center gap-2">
        {SUPPORTED_LOCALES.map((locale) => (
          <Button
            aria-pressed={locale === currentLocale}
            disabled={isPending}
            key={locale}
            onClick={() => handleLocaleSelect(locale)}
            size="sm"
            type="button"
            variant={locale === currentLocale ? "default" : "outline"}
          >
            {LOCALE_LABELS[locale]}
          </Button>
        ))}
      </div>
    </section>
  );
}
