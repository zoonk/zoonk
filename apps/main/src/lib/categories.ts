import type { CourseCategory } from "@zoonk/utils/categories";
import type { LucideIcon } from "lucide-react";
import {
  Briefcase,
  Calculator,
  Clock,
  Cpu,
  FlaskConical,
  Globe,
  Heart,
  Languages,
  Map as MapIcon,
  MessageCircle,
  Palette,
  Scale,
  TrendingUp,
  Users,
  Wrench,
} from "lucide-react";
import { getExtracted } from "next-intl/server";

export type CategoryInfo = {
  icon: LucideIcon;
  key: CourseCategory;
  label: string;
};

export const CATEGORY_ICONS: Record<CourseCategory, LucideIcon> = {
  arts: Palette,
  business: Briefcase,
  communication: MessageCircle,
  culture: Globe,
  economics: TrendingUp,
  engineering: Wrench,
  geography: MapIcon,
  health: Heart,
  history: Clock,
  languages: Languages,
  law: Scale,
  math: Calculator,
  science: FlaskConical,
  society: Users,
  tech: Cpu,
};

export async function getCategories(params?: {
  locale: string;
}): Promise<CategoryInfo[]> {
  const t = await getExtracted(params);

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

async function getCategoryLabel(
  category: CourseCategory,
  opts?: {
    locale: string;
  },
): Promise<string> {
  const categories = await getCategories(opts);

  return categories.find((cat) => cat.key === category)?.label ?? "";
}

export async function getCategoryMeta(params: {
  locale: string;
  category: CourseCategory;
}) {
  const t = await getExtracted(params);
  const label = await getCategoryLabel(params.category, params);

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
