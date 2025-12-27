import type { CourseCategory } from "@zoonk/utils/categories";
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

export async function getCategoryData(category: CourseCategory) {
  const t = await getExtracted();

  const data = {
    arts: { icon: Palette, label: t("Arts") },
    business: { icon: Briefcase, label: t("Business") },
    communication: { icon: MessageCircle, label: t("Communication") },
    culture: { icon: Globe, label: t("Culture") },
    economics: { icon: TrendingUp, label: t("Economics") },
    engineering: { icon: Wrench, label: t("Engineering") },
    geography: { icon: MapIcon, label: t("Geography") },
    health: { icon: Heart, label: t("Health") },
    history: { icon: Clock, label: t("History") },
    languages: { icon: Languages, label: t("Languages") },
    law: { icon: Scale, label: t("Law") },
    math: { icon: Calculator, label: t("Math") },
    science: { icon: FlaskConical, label: t("Science") },
    society: { icon: Users, label: t("Society") },
    tech: { icon: Cpu, label: t("Technology") },
  };

  return data[category];
}
