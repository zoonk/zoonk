"use client";

import { useDebouncedValue } from "@zoonk/ui/hooks/use-debounced-value";
import { useExtracted } from "next-intl";
import {
  useCallback,
  useEffect,
  useEffectEvent,
  useState,
  useTransition,
} from "react";
import { checkSlugExistsAction } from "./actions";

export type CourseFormData = {
  title: string;
  description: string;
  language: string;
  slug: string;
};

const SLUG_DEBOUNCE_DELAY_MS = 300;

export function useCourseForm({
  defaultLanguage,
  orgSlug,
}: {
  defaultLanguage: string;
  orgSlug: string;
}) {
  const t = useExtracted();
  const [_isPending, startTransition] = useTransition();
  const [slugExists, setSlugExists] = useState(false);

  const [formData, setFormData] = useState<CourseFormData>({
    description: "",
    language: defaultLanguage,
    slug: "",
    title: "",
  });

  const debouncedSlug = useDebouncedValue(
    formData.slug,
    SLUG_DEBOUNCE_DELAY_MS,
  );

  const handleSlugCheck = useEffectEvent((exists: boolean) => {
    setSlugExists(exists);
  });

  useEffect(() => {
    if (!debouncedSlug.trim()) {
      handleSlugCheck(false);
      return;
    }

    startTransition(async () => {
      const exists = await checkSlugExistsAction({
        language: formData.language,
        orgSlug,
        slug: debouncedSlug,
      });

      handleSlugCheck(exists);
    });
  }, [debouncedSlug, formData.language, orgSlug]);

  const updateField = useCallback(
    <K extends keyof CourseFormData>(field: K, value: CourseFormData[K]) => {
      setFormData((prev) => ({ ...prev, [field]: value }));
    },
    [],
  );

  const canProceedFromStep = useCallback(
    (stepName: string): boolean => {
      switch (stepName) {
        case "title":
          return formData.title.trim().length > 0;
        case "language":
          return formData.language.length > 0;
        case "description":
          return formData.description.trim().length > 0;
        case "slug":
          return formData.slug.trim().length > 0 && !slugExists;
        default:
          return false;
      }
    },
    [formData, slugExists],
  );

  const getStepError = useCallback(
    (stepName: string): string | null => {
      if (stepName === "slug" && slugExists) {
        return t("A course with this URL already exists");
      }
      return null;
    },
    [slugExists, t],
  );

  return {
    canProceedFromStep,
    formData,
    getStepError,
    updateField,
  };
}
