"use client";

import {
  WizardDescription,
  WizardField,
  WizardInput,
  WizardLabel,
} from "@zoonk/ui/components/wizard";
import { useDebouncedValue } from "@zoonk/ui/hooks/use-debounced-value";
import { useExtracted } from "next-intl";
import {
  useEffect,
  useEffectEvent,
  useId,
  useState,
  useTransition,
} from "react";
import slugify from "slugify";
import { checkSlugExistsAction } from "../actions";

const SLUG_DEBOUNCE_DELAY_MS = 300;
const COURSE_URL_PREFIX = "/c/";

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
  const [_isPending, startTransition] = useTransition();
  const [slugExists, setSlugExists] = useState(false);
  const debouncedSlug = useDebouncedValue(value, SLUG_DEBOUNCE_DELAY_MS);

  const slugExistsCallback = useEffectEvent((exists: boolean) => {
    setSlugExists(exists);
    onSlugExists(exists);
  });

  // Auto-fill slug from title when entering this step if slug is empty
  useEffect(() => {
    if (!value && title) {
      onChange(slugify(title, { lower: true, strict: true }));
    }
  }, [onChange, title, value]);

  // Check if slug exists when debounced value changes
  useEffect(() => {
    if (!debouncedSlug.trim()) {
      slugExistsCallback(false);
      return;
    }

    startTransition(async () => {
      const exists = await checkSlugExistsAction({
        language,
        orgSlug,
        slug: debouncedSlug,
      });

      slugExistsCallback(exists);
    });
  }, [debouncedSlug, language, orgSlug]);

  const slugErrorMessage = slugExists
    ? t("A course with this URL already exists")
    : null;

  const errorMessage = error || slugErrorMessage;

  return (
    <WizardField>
      <WizardLabel htmlFor={slugId}>{t("Course URL")}</WizardLabel>

      <WizardDescription>
        {t("This will be the URL path for your course")}
      </WizardDescription>

      <div className="flex items-baseline gap-2">
        <span className="text-muted-foreground">{COURSE_URL_PREFIX}</span>
        <WizardInput
          autoFocus
          className="text-muted-foreground"
          id={slugId}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t("course-title")}
          value={value}
        />
      </div>

      <p className="text-destructive text-sm">{errorMessage}</p>
    </WizardField>
  );
}
