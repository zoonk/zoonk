"use client";

import {
  WizardDescription,
  WizardInput,
  WizardLabel,
} from "@zoonk/ui/components/wizard";
import { validateSlug } from "@zoonk/utils/string";
import { useExtracted } from "next-intl";
import { useEffect, useId, useMemo } from "react";
import slugify from "slugify";

type SlugStepProps = {
  title: string;
  language: string;
  value: string;
  onChange: (value: string) => void;
  error?: string | null;
};

export function SlugStep({
  title,
  language,
  value,
  onChange,
  error,
}: SlugStepProps) {
  const t = useExtracted();
  const slugId = useId();

  // Auto-fill slug from title when entering this step if slug is empty
  useEffect(() => {
    if (!value && title) {
      onChange(slugify(title, { lower: true, strict: true }));
    }
  }, [onChange, title, value]); // Only run on mount

  const validation = useMemo(() => validateSlug(value), [value]);
  const showValidationError = value.length > 0 && !validation.isValid;

  return (
    <div className="flex flex-col gap-2">
      <WizardLabel htmlFor={slugId}>{t("COURSE URL")}</WizardLabel>
      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground">{`/${language}/c/`}</span>
        <WizardInput
          autoFocus
          className="text-muted-foreground"
          id={slugId}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("course-title")}
          value={value}
        />
      </div>
      <WizardDescription>
        {t("This will be the URL path for your course")}
      </WizardDescription>
      {showValidationError && (
        <p className="text-destructive text-sm">{validation.error}</p>
      )}
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
