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
import type { CourseCategory } from "@zoonk/utils/categories";
import type { LucideIcon } from "lucide-react";

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
