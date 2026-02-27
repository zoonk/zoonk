"use client";

import { Field, FieldContent, FieldLabel } from "@zoonk/ui/components/field";
import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import { setCookie } from "@zoonk/utils/cookies";
import { LOCALE_COOKIE, LOCALE_LABELS, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { useExtracted, useLocale } from "next-intl";

export function LocaleSwitcher() {
  const t = useExtracted();
  const locale = useLocale();

  function onSelectChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextLocale = event.target.value;
    setCookie(LOCALE_COOKIE, nextLocale, { expires: 365, sameSite: "lax" });
    globalThis.location.reload();
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
