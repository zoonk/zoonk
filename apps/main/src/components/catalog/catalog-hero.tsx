import { LineMarker } from "@zoonk/ui/components/line-marker";
import { MapIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/*
 * The lines of a catalog page's first screen, in one place for the course, chapter and lesson
 * pages.
 */

/**
 * A course's first screen: the course on the left and, with `COURSE_HERO_PAIR_CLASS`, what it
 * shows beside it (the question to try, or the example plan without one) from `xl`, at the page's
 * right edge however wide the screen, under it before.
 */
export const COURSE_HERO_CLASS = "grid grid-cols-1 gap-9 xl:items-start xl:gap-12";

export const COURSE_HERO_PAIR_CLASS = "xl:grid-cols-[minmax(0,1fr)_minmax(0,31rem)]";

/** A course's, a chapter's or a lesson's name on its page, the public pages' headline. */
export const COURSE_TITLE_CLASS = "text-headline";

/** Under a course's or a chapter's title: what it makes someone able to do. */
export const HERO_LEAD_CLASS = "text-lead mt-4";

/** Under a lesson's title: why it matters. */
export const LESSON_LEAD_CLASS = "text-lead mt-3";

/** The line on what Zoonk does with the course (`PlanLine`). */
const PLAN_LINE_CLASS = "text-muted-foreground mt-4 flex gap-2 text-[0.9375rem] leading-snug";

/**
 * What Zoonk does with the page's course, in one line on its first screen: a plan that starts at
 * the visitor's level, or at the page's chapter (`startsHere`), and fits their schedule. It leads
 * to the button that builds that plan, so it's quieter than the page's own promise above it, after
 * the Plan's map, as the tab it opens is marked.
 */
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
