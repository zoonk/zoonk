"use client";

import {
  WizardDescription,
  WizardField,
  WizardLabel,
  WizardTextarea,
} from "@zoonk/ui/components/wizard";
import { useKeyboardCallback } from "@zoonk/ui/hooks/use-keyboard";
import { useExtracted } from "next-intl";
import { useId } from "react";

type DescriptionStepProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
};

export function DescriptionStep({
  value,
  onChange,
  onSubmit,
}: DescriptionStepProps) {
  const t = useExtracted();
  const descriptionId = useId();

  useKeyboardCallback("Enter", onSubmit);

  return (
    <WizardField>
      <WizardLabel htmlFor={descriptionId}>
        {t("COURSE DESCRIPTION")}
      </WizardLabel>

      <WizardTextarea
        autoFocus
        id={descriptionId}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("A brief description of your course…")}
        value={value}
      />

      <WizardDescription>
        {t("A short summary that helps learners understand what they'll learn")}
      </WizardDescription>
    </WizardField>
  );
}
