import { LineMarker } from "@zoonk/ui/components/line-marker";
import { MapIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

export const COURSE_HERO_CLASS = "grid grid-cols-1 gap-9 xl:items-start xl:gap-12";

export const COURSE_HERO_PAIR_CLASS = "xl:grid-cols-[minmax(0,1fr)_minmax(0,31rem)]";

export const COURSE_TITLE_CLASS = "text-headline";

export const HERO_LEAD_CLASS = "text-lead mt-4";

export const LESSON_LEAD_CLASS = "text-lead mt-3";

const PLAN_LINE_CLASS = "text-muted-foreground mt-4 flex gap-2 text-[0.9375rem] leading-snug";

export async function PlanLine({ startsHere = false }: { startsHere?: boolean }) {
  const t = await getExtracted();

  return (
    <p className={PLAN_LINE_CLASS}>
      <LineMarker>
        <MapIcon aria-hidden="true" className="size-4" />
      </LineMarker>

      <span className="text-pretty">
        {startsHere
          ? t("With Zoonk, your plan starts at this chapter and fits your schedule.")
          : t("With Zoonk, your plan starts at your level and fits your schedule.")}
      </span>
    </p>
  );
}
