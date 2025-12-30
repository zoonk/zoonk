"use client";

import {
  COURSE_CATEGORIES,
  type CourseCategory,
} from "@zoonk/utils/categories";
import { useExtracted } from "next-intl";

type CategoryLabels = Record<CourseCategory, string>;

type UseCategoryLabelsResult = {
  labels: CategoryLabels;
  getLabel: (category: string) => string | null;
};

export function useCategoryLabels(): UseCategoryLabelsResult {
  const t = useExtracted();

  const labels: CategoryLabels = {
    arts: t("Arts"),
    business: t("Business"),
    communication: t("Communication"),
    culture: t("Culture"),
    economics: t("Economics"),
    engineering: t("Engineering"),
    geography: t("Geography"),
    health: t("Health"),
    history: t("History"),
    languages: t("Languages"),
    law: t("Law"),
    math: t("Math"),
    science: t("Science"),
    society: t("Society"),
    tech: t("Technology"),
  };

  function getLabel(category: string): string | null {
    if (!COURSE_CATEGORIES.includes(category as CourseCategory)) {
      return null;
    }
    return labels[category as CourseCategory];
  }

  return { getLabel, labels };
}
