"use client";

import {
  WizardDescription,
  WizardField,
  WizardInput,
  WizardLabel,
} from "@zoonk/ui/components/wizard";
import { useDebouncedValue } from "@zoonk/ui/hooks/use-debounced-value";
import { useExtracted } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import slugify from "slugify";
import { checkSlugExistsAction } from "../actions";

const SLUG_DEBOUNCE_DELAY_MS = 300;

type SlugStepProps = {
  title: string;
  language: string;
  orgSlug: string;
  value: string;
  onChange: (value: string) => void;
  onSlugExists: (exists: boolean) => void;
  error?: string | null;
};

export function SlugStep({
  title,
  language,
  orgSlug,
  value,
  onChange,
  onSlugExists,
  error,
}: SlugStepProps) {
  const t = useExtracted();
  const slugId = useId();
  const [isPending, startTransition] = useTransition();
  const [slugExists, setSlugExists] = useState(false);
  const debouncedSlug = useDebouncedValue(value, SLUG_DEBOUNCE_DELAY_MS);

  // Auto-fill slug from title when entering this step if slug is empty
  useEffect(() => {
    if (!value && title) {
      onChange(slugify(title, { lower: true, strict: true }));
    }
  }, [onChange, title, value]);

  // Check if slug exists when debounced value changes
  useEffect(() => {
    if (!debouncedSlug.trim()) {
      setSlugExists(false);
      onSlugExists(false);
      return;
    }

    startTransition(async () => {
      const exists = await checkSlugExistsAction({
        language,
        orgSlug,
        slug: debouncedSlug,
      });
      setSlugExists(exists);
      onSlugExists(exists);
    });
  }, [debouncedSlug, language, orgSlug, onSlugExists]);

  const showSlugError = slugExists && !isPending;

  return (
    <WizardField>
      <WizardLabel htmlFor={slugId}>{t("Course URL")}</WizardLabel>

      <WizardDescription>
        {isPending
          ? t("Checking availability…")
          : t("This will be the URL path for your course")}
      </WizardDescription>

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

      {showSlugError && (
        <p className="text-destructive text-sm">
          {t("A course with this URL already exists")}
        </p>
      )}

      {error && !showSlugError && (
        <p className="text-destructive text-sm">{error}</p>
      )}
    </WizardField>
  );
}
