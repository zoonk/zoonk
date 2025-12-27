import type { CourseCategory } from "@zoonk/utils/categories";
import { getExtracted } from "next-intl/server";

export async function getCategoryLabel(category: CourseCategory) {
  const t = await getExtracted();

  const labels: Record<CourseCategory, string> = {
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

  return labels[category];
}
