import { type GoalKind } from "@zoonk/db/enums";
import { cn } from "@zoonk/ui/lib/utils";
import {
  BookOpenIcon,
  GraduationCapIcon,
  LanguagesIcon,
  LightbulbIcon,
  type LucideIcon,
} from "lucide-react";

/** An exam and a course wear their pages' icons, so a goal reads as what it studies. */
const GOAL_KIND_ICONS: Record<GoalKind, LucideIcon> = {
  exam: GraduationCapIcon,
  explain: LightbulbIcon,
  language: LanguagesIcon,
  learn: BookOpenIcon,
};

export function GoalKindIcon({ className, kind }: { className?: string; kind: GoalKind }) {
  const Icon = GOAL_KIND_ICONS[kind];

  return (
    <Icon aria-hidden="true" className={cn("text-muted-foreground size-4 shrink-0", className)} />
  );
}
