import { LineMarker } from "@zoonk/ui/components/line-marker";
import { MapIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export const COURSE_HERO_CLASS = "grid grid-cols-1 gap-9 xl:items-start xl:gap-12";

export const COURSE_HERO_PAIR_CLASS = "xl:grid-cols-[minmax(0,1fr)_minmax(0,31rem)]";

export const COURSE_TITLE_CLASS = "text-headline";

export const HERO_LEAD_CLASS = "text-lead mt-4";

export const LESSON_LEAD_CLASS = "text-lead mt-3";

const PLAN_LINE_CLASS = "text-muted-foreground mt-4 flex gap-2 text-[0.9375rem] leading-snug";

type PlanStart = "chapter" | "exam" | "known";

export async function PlanLine({ start = "known" }: { start?: PlanStart }) {
  const t = await getExtracted();

  const lines: Record<PlanStart, string> = {
    chapter: t(
      "Zoonk builds you a plan for each day. It fits your time and starts at this chapter.",
    ),
    exam: t(
      "Zoonk builds you a plan for each day until your exam. It fits your time and starts from what you already know.",
    ),
    known: t(
      "Zoonk builds you a plan for each day. It fits your time and starts from what you already know.",
    ),
  };

  return (
    <p className={PLAN_LINE_CLASS}>
      <LineMarker>
        <MapIcon aria-hidden="true" className="size-4" />
      </LineMarker>

      <span className="text-pretty">{lines[start]}</span>
    </p>
  );
}
