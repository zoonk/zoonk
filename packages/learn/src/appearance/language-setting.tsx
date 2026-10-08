"use client";

import { NativeSelect, NativeSelectOption } from "@zoonk/ui/components/native-select";
import {
  LOCALE_LABELS,
  SUPPORTED_LOCALES,
  type SupportedLocale,
  isValidLocale,
} from "@zoonk/utils/locale";
import { LanguagesIcon } from "lucide-react";
import { useExtracted, useLocale } from "next-intl";
import { useId } from "react";
import {
  SettingCard,
  SettingCardDescription,
  SettingCardIcon,
  SettingCardLabel,
  SettingCardText,
} from "../_components/setting-card";

/**
 * The app's language on this device. Each language is named in itself, so anyone can find theirs
 * whatever the screen is in. The host changes it, since that's a navigation to the new language's
 * page.
 */
export function LanguageSetting({ onChange }: { onChange: (locale: SupportedLocale) => void }) {
  const t = useExtracted();
  const locale = useLocale();
  const selectId = useId();
  const descriptionId = useId();

  return (
    <SettingCard>
      <SettingCardIcon icon={LanguagesIcon} />
      {/* The select needs room: under the text on phones, beside it from tablets up. */}
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
        <SettingCardText>
          <SettingCardLabel>
            <label htmlFor={selectId}>{t("App language")}</label>
          </SettingCardLabel>
          <SettingCardDescription id={descriptionId}>{t("On this device")}</SettingCardDescription>
        </SettingCardText>

        <NativeSelect
          aria-describedby={descriptionId}
          defaultValue={locale}
          id={selectId}
          onChange={(event) => {
            if (isValidLocale(event.target.value)) {
              onChange(event.target.value);
            }
          }}
        >
          {SUPPORTED_LOCALES.map((option) => (
            <NativeSelectOption key={option} lang={option} value={option}>
              {LOCALE_LABELS[option]}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </div>
    </SettingCard>
  );
}
