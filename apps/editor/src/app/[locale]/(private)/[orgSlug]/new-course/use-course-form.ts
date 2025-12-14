"use client";

import { validateSlug } from "@zoonk/utils/string";
import { useCallback, useState } from "react";

export type CourseFormData = {
  title: string;
  description: string;
  language: string;
  slug: string;
};

type UseCourseFormOptions = {
  defaultLanguage: string;
};

export function useCourseForm({ defaultLanguage }: UseCourseFormOptions) {
  const [formData, setFormData] = useState<CourseFormData>({
    description: "",
    language: defaultLanguage,
    slug: "",
    title: "",
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
        case "slug": {
          const validation = validateSlug(formData.slug);
          return formData.slug.trim().length > 0 && validation.isValid;
        }
        default:
          return false;
      }
    },
    [formData],
  );

  return {
    canProceedFromStep,
    formData,
    updateField,
  };
}
