"use client";

import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  isValidLocale,
} from "@zoonk/utils/locale";
import { useExtracted } from "next-intl";
import { useId } from "react";
import { SettingRow } from "../_components/setting-rows";
import { useAppLocale } from "../_utils/locale";

/** Each language is named in itself, so anyone can find theirs. */
export function LanguageSetting({ onChange }: { onChange: (locale: SupportedLocale) => void }) {
  const t = useExtracted();
  const locale = useAppLocale();
  const selectId = useId();

  return (
    <SettingRow label={<label htmlFor={selectId}>{t("App language")}</label>}>
      <NativeSelect
        defaultValue={locale}
        id={selectId}
        onChange={(event) => {
          if (isValidLocale(event.target.value)) {
            onChange(event.target.value);
          }
        }}
        size="sm"
      >
        {SUPPORTED_LOCALES.map((option) => (
          <NativeSelectOption key={option} lang={option} value={option}>
            {LOCALE_LABELS[option]}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </SettingRow>
  );
}
