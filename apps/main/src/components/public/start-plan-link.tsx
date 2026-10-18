import { Link } from "@/i18n/navigation";
import { getCourseStartHref } from "@/lib/public/public-hrefs";
import { ArrowRightIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";
import { getSecondaryStartControlClassName, getStartControlClassName } from "./public-start";

/**
 * "Build my plan" on a public page, the same words as the end of a visitor's lesson: it opens the
 * course's start page, which says what the plan will be (asking the visitor's level for a whole
 * course, or showing the plan from `chapterId` on) and has the one button that starts it. Opening
 * it creates nothing, so the page that sells the course never commits anyone on a tap they made to
 * learn more, and a prefetch is harmless; `nofollow` keeps crawlers on the indexed pages, since the
 * start page isn't one. `secondary` draws it as an outline button, for a page whose main action is
 * another one (a lesson's first question). `minutes` is the time a day the page's example plan
 * shows, which the plan starts with. `continues` names it for a learner whose goal already follows
 * the course, whom the start page sends back to it.
 */
export async function StartPlanLink({
  chapterId,
  continues = false,
  courseId,
  minutes,
  secondary = false,
}: {
  chapterId?: string | null;
  continues?: boolean;
  courseId: string;
  minutes?: number;
  secondary?: boolean;
}) {
  const t = await getExtracted();

  return (
    <Link
      className={secondary ? getSecondaryStartControlClassName() : getStartControlClassName()}
      href={getCourseStartHref({ chapterId, courseId, minutes })}
      prefetch
      rel="nofollow"
    >
      {continues ? t("Continue your plan") : t("Build my plan")}
      <ArrowRightIcon aria-hidden="true" data-icon="inline-end" />
    </Link>
  );
}
