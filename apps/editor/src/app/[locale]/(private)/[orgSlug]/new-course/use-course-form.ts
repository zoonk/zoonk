"use client";

import { useExtracted, useLocale } from "next-intl";
import { useCallback, useState } from "react";
import { useSlugCheck } from "@/lib/slug";

export type CourseFormData = {
  title: string;
  description: string;
  language: string;
  slug: string;
};

/**
 * Data validation and state management for the course creation form.
 */
export function useCourseForm({ orgSlug }: { orgSlug: string }) {
  const t = useExtracted();
  const defaultLanguage = useLocale();

  const [formData, setFormData] = useState<CourseFormData>({
    description: "",
    language: defaultLanguage,
    slug: "",
    title: "",
  });

  const slugExists = useSlugCheck({
    language: formData.language,
    orgSlug,
    slug: formData.slug,
  });

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
