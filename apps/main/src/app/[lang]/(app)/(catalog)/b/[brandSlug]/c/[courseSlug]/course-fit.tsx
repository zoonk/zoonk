import { COURSE_HERO_PAIR_CLASS } from "@/components/catalog/catalog-hero";
import { CheckItem } from "@/components/public/check-mark";
import { type CourseLandingPageContent } from "@zoonk/core/courses/landing-page";
import { RouteMark, RouteStop, RouteTitle } from "@zoonk/learn/route-line";
import { cn } from "@zoonk/ui/lib/utils";
import { getExtracted } from "next-intl/server";

const STOP_CLASS = "flex flex-col gap-5";
const LIST_CLASS = "divided-rows max-w-column flex flex-col";
const ROW_CLASS = "py-3 text-reading leading-relaxed first:pt-0 last:pb-0";

/** The details step writes only a few short lines (`PAGE_LISTS` in `@zoonk/ai`), so they all show. */
function OutcomeList({ outcomes }: { outcomes: string[] }) {
  return (
    <ul className={LIST_CLASS}>
      {outcomes.map((item) => (
        <CheckItem className={ROW_CLASS} key={item}>
          {item}
        </CheckItem>
      ))}
    </ul>
  );
}

export async function CourseFit({
  className,
  content,
  courseId,
}: {
  className?: string;
  content: CourseLandingPageContent | null;
  courseId: string;
}) {
  const t = await getExtracted();
  const audience = content?.audience ?? [];
  const outcomes = content?.outcomes ?? [];

  if (outcomes.length === 0 && audience.length === 0) {
    return null;
  }

  const audienceId = `course-audience-${courseId}`;
  const outcomesId = `course-outcomes-${courseId}`;

  if (audience.length === 0) {
    return (
      <RouteStop aria-labelledby={outcomesId} className={cn(STOP_CLASS, className)}>
        <RouteTitle down id={outcomesId}>
          {t("What you'll be able to do")}
        </RouteTitle>
        <OutcomeList outcomes={outcomes} />
      </RouteStop>
    );
  }

  return (
    <div
      className={cn("grid grid-cols-1 xl:gap-x-12", outcomes.length > 0 && COURSE_HERO_PAIR_CLASS)}
    >
      <RouteStop aria-labelledby={audienceId} className={cn(STOP_CLASS, className)}>
        <RouteTitle down id={audienceId}>
          {t("Who it's for")}
        </RouteTitle>

        <ul className={LIST_CLASS}>
          {audience.map((item) => (
            <li className={cn(ROW_CLASS, "text-pretty")} key={item}>
              {item}
            </li>
          ))}
        </ul>
      </RouteStop>

      {outcomes.length > 0 && (
        <RouteStop aria-labelledby={outcomesId} className={cn(STOP_CLASS, "xl:pl-0", className)}>
          <h2 className="text-section relative" id={outcomesId}>
            <RouteMark className="xl:hidden" down up />
            {t("What you'll be able to do")}
          </h2>

          <OutcomeList outcomes={outcomes} />
        </RouteStop>
      )}
    </div>
  );
}
