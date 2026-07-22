"use client";

import { getPathname, usePathname } from "@/i18n/navigation";
import { Field, FieldContent, FieldLabel } from "@zoonk/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { Skeleton } from "@zoonk/ui/components/skeleton";
import { LOCALE_LABELS, SUPPORTED_LOCALES, isValidLocale } from "@zoonk/utils/locale";
import { useExtracted, useLocale } from "next-intl";

export function LocaleSwitcher() {
  const t = useExtracted();
  const locale = useLocale();
  const pathname = usePathname();

  /**
   * Use a document navigation because changing the root language through the
   * client router can lose its in-flight response when the proxy canonicalizes
   * English. The forced prefix lets the proxy persist the explicit choice
   * before redirecting English to its unprefixed URL.
   */
  function onSelectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;

    if (!isValidLocale(nextLocale)) {
      return;
    }

    const targetPathname = getPathname({ forcePrefix: true, href: pathname, locale: nextLocale });
    globalThis.location.replace(targetPathname);
  }

  return (
    <Field>
      <FieldContent>
        <FieldLabel htmlFor="language">{t("Language")}</FieldLabel>
        <NativeSelect
          aria-label={t("Update language")}
          className="w-full sm:w-70"
          defaultValue={locale}
          id="language"
          onChange={onSelectChange}
        >
          {SUPPORTED_LOCALES.map((lang) => (
            <NativeSelectOption key={lang} value={lang}>
              {LOCALE_LABELS[lang]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </FieldContent>
    </Field>
  );
}

/**
 * Keeps the language setting's space stable while the current pathname becomes available on the client.
 */
export function LocaleSwitcherSkeleton() {
  return (
    <Field>
      <FieldContent>
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-9 w-full sm:w-70" />
      </FieldContent>
    </Field>
  );
}
