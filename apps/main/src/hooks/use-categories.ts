"use client";

import { useExtracted } from "next-intl";
import type { CategoryInfo } from "@/lib/categories";
import { CATEGORY_ICONS } from "@/lib/categories";

export function useCategories(): CategoryInfo[] {
  const t = useExtracted();

  return [
    { icon: CATEGORY_ICONS.arts, key: "arts", label: t("Arts") },
    { icon: CATEGORY_ICONS.business, key: "business", label: t("Business") },
    {
      icon: CATEGORY_ICONS.communication,
      key: "communication",
      label: t("Communication"),
    },
    { icon: CATEGORY_ICONS.culture, key: "culture", label: t("Culture") },
    {
      icon: CATEGORY_ICONS.economics,
      key: "economics",
      label: t("Economics"),
    },
    {
      icon: CATEGORY_ICONS.engineering,
      key: "engineering",
      label: t("Engineering"),
    },
    {
      icon: CATEGORY_ICONS.geography,
      key: "geography",
      label: t("Geography"),
    },
    { icon: CATEGORY_ICONS.health, key: "health", label: t("Health") },
    { icon: CATEGORY_ICONS.history, key: "history", label: t("History") },
    {
      icon: CATEGORY_ICONS.languages,
      key: "languages",
      label: t("Languages"),
    },
    { icon: CATEGORY_ICONS.law, key: "law", label: t("Law") },
    { icon: CATEGORY_ICONS.math, key: "math", label: t("Math") },
    { icon: CATEGORY_ICONS.science, key: "science", label: t("Science") },
    { icon: CATEGORY_ICONS.society, key: "society", label: t("Society") },
    { icon: CATEGORY_ICONS.tech, key: "tech", label: t("Technology") },
  ];
}
