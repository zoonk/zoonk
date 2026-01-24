"use client";

import {
  WizardDescription,
  WizardField,
  WizardInput,
  WizardLabel,
} from "@zoonk/ui/components/wizard";
import { useExtracted } from "next-intl";
import { useId } from "react";

export function TitleStep({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const t = useExtracted();
  const titleId = useId();

  return (
    <WizardField>
      <WizardLabel htmlFor={titleId}>{t("Course title")}</WizardLabel>

      <WizardDescription>
        {t("The main title that learners will see for your course")}
      </WizardDescription>

      <WizardInput
        autoFocus
        id={titleId}
        onChange={(event) => onChange(event.target.value)}
        placeholder={t("course title")}
        value={value}
      />
    </WizardField>
  );
}
