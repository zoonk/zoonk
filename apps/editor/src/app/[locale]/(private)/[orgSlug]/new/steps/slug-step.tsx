"use client";

import {
  WizardDescription,
  WizardError,
  WizardField,
  WizardInput,
  WizardInputGroup,
  WizardInputPrefix,
  WizardLabel,
} from "@zoonk/ui/components/wizard";
import { toSlug } from "@zoonk/utils/string";
import { useExtracted } from "next-intl";
import { useEffect, useEffectEvent, useId } from "react";

const COURSE_URL_PREFIX = "/c/";

export function SlugStep({
  title,
  value,
  onChange,
  error,
}: {
  title: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
}) {
  const t = useExtracted();
  const slugId = useId();

  const handleChange = useEffectEvent((newValue: string) => {
    onChange(newValue);
  });

  // Auto-fill slug from title when entering this step if slug is empty
  useEffect(() => {
    if (!value && title) {
      handleChange(toSlug(title));
    }
  }, [title, value]);

  return (
    <WizardField>
      <WizardLabel htmlFor={slugId}>{t("Course URL")}</WizardLabel>

      <WizardDescription>
        {t("This will be the URL path for your course")}
      </WizardDescription>

      <WizardInputGroup>
        <WizardInputPrefix>{COURSE_URL_PREFIX}</WizardInputPrefix>
        <WizardInput
          autoCapitalize="off"
          autoComplete="off"
          autoCorrect="off"
          autoFocus
          className="text-muted-foreground"
          id={slugId}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("course-title")}
          spellCheck="false"
          value={value}
        />
      </WizardInputGroup>

      <WizardError>{error}</WizardError>
    </WizardField>
  );
}
