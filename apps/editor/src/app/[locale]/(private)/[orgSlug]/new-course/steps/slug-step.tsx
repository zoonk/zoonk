"use client";

import {
  WizardDescription,
  WizardInput,
  WizardLabel,
} from "@zoonk/ui/components/wizard";
import { useExtracted } from "next-intl";
import { useEffect, useId } from "react";
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
  }, [onChange, title, value]);

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
      {error && <p className="text-destructive text-sm">{error}</p>}
    </div>
  );
}
