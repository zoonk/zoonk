"use client";

import {
  WizardDescription,
  WizardField,
  WizardGroup,
  WizardLabel,
  WizardRadioGroup,
  WizardRadioGroupItem,
} from "@zoonk/ui/components/wizard";
import { LOCALE_LABELS, SUPPORTED_LOCALES } from "@zoonk/utils/locale";
import { useExtracted } from "next-intl";

export function LanguageStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useExtracted();

  return (
    <WizardGroup>
      <WizardField>
        <WizardLabel>{t("Course language")}</WizardLabel>

        <WizardDescription>
          {t("Select the language your course content will be in")}
        </WizardDescription>
      </WizardField>

      <WizardRadioGroup onValueChange={onChange} value={value}>
        {SUPPORTED_LOCALES.map((locale) => (
          <WizardRadioGroupItem
            autoFocus={locale === value}
            key={locale}
            value={locale}
          >
            {LOCALE_LABELS[locale]}
          </WizardRadioGroupItem>
        ))}
      </WizardRadioGroup>
    </WizardGroup>
  );
}
