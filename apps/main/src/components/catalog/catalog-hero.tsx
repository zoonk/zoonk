import { getExtracted } from "next-intl/server";

/*
 * The lines of a catalog page's first screen, in one place for the course, chapter and lesson
 * pages.
 */

/**
 * A course's first screen: the course on the left and its example plan beside it from `xl`, at the
 * page's right edge however wide the screen, under it before; the course alone when it has no plan
 * to show.
 */
export const COURSE_HERO_CLASS =
  "grid grid-cols-1 gap-9 xl:items-start xl:gap-12 xl:has-[[data-slot=course-plan]]:grid-cols-[minmax(0,1fr)_minmax(0,33rem)]";

/** A course's name on its page: the app's page title, larger from `lg`, where the plan sits beside it. */
export const COURSE_TITLE_CLASS = "text-title lg:text-[2.75rem] lg:leading-[1.04]";

/** Under a course's or a chapter's title: what it makes someone able to do. */
export const HERO_LEAD_CLASS =
  "text-muted-foreground mt-3 text-base leading-relaxed text-pretty sm:text-[1.0625rem]";

/** Under a lesson's title: why it matters. */
export const LESSON_LEAD_CLASS =
  "text-muted-foreground mt-3 text-[0.9375rem] leading-relaxed text-pretty";

/** The line on what Zoonk does with the course (`PlanLine`). */
const PLAN_LINE_CLASS = "mt-3 text-[0.9375rem] leading-snug font-medium text-pretty";

/**
 * What Zoonk does with the page's course, in one line on its first screen: a plan that starts at
 * the visitor's level, or at the page's chapter (`startsHere`), and fits their schedule.
 */
export async function PlanLine({ startsHere = false }: { startsHere?: boolean }) {
  const t = await getExtracted();

  return (
    <p className={PLAN_LINE_CLASS}>
      {startsHere
        ? t("With Zoonk, your plan starts at this chapter and fits your schedule.")
        : t("With Zoonk, your plan starts at your level and fits your schedule.")}
    </p>
  );
}
