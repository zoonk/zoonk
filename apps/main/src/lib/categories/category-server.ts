import { type CourseCategory } from "@zoonk/utils/categories";
import { getExtracted } from "next-intl/server";
import { CATEGORY_ICONS, type CategoryInfo } from "./category-icons";

export async function getCategories(): Promise<CategoryInfo[]> {
  const t = await getExtracted();

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

async function getCategoryLabel(category: CourseCategory): Promise<string> {
  const categories = await getCategories();

  return categories.find((cat) => cat.key === category)?.label ?? "";
}

export async function getCategoryMeta(params: { category: CourseCategory }) {
  const t = await getExtracted();
  const label = await getCategoryLabel(params.category);

  return {
    description: t(
      "{category} courses. The best {category} online courses, interactive lessons to learn.",
      {
        category: label,
      },
    ),
    title: t("{category} Courses", { category: label }),
  };
}

export async function getCategoryHeader(category: CourseCategory) {
  const t = await getExtracted();
  const label = await getCategoryLabel(category);

  return {
    description: t("Explore all {category} courses", { category: label }),
    title: t("{category} courses", { category: label }),
  };
}
