"use client";

import {
  WizardDescription,
  WizardField,
  WizardLabel,
  WizardTextarea,
} from "@zoonk/ui/components/wizard";
import { useExtracted } from "next-intl";
import { useId } from "react";

export function DescriptionStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useExtracted();
  const descriptionId = useId();

  return (
    <WizardField>
      <WizardLabel htmlFor={descriptionId}>{t("Course description")}</WizardLabel>

      <WizardDescription>
        {t("A short summary that helps learners understand what they'll learn")}
      </WizardDescription>

      <WizardTextarea
        autoFocus
        id={descriptionId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("A brief description of your course…")}
        value={value}
      />
    </WizardField>
  );
}
