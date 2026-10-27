import { CheckMark } from "@/components/public/check-mark";
import { type CourseLandingPageContent } from "@zoonk/core/courses/landing-page";
import { RouteStop, RouteTitle } from "@zoonk/learn/route-line";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRightIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/**
 * What the course makes someone able to do, each after a tick, its first steps first. The details
 * step writes a few short lines (`PAGE_LISTS` in `@zoonk/ai`), so they all show.
 */
function OutcomeList({ outcomes }: { outcomes: string[] }) {
  return (
    <ul className="flex flex-col gap-3">
      {outcomes.map((item) => (
        <li className="flex gap-3 text-[0.9375rem] leading-relaxed" key={item}>
          <LineMarker>
            <CheckMark size="sm" />
          </LineMarker>
          <span className="text-pretty">{item}</span>
        </li>
      ))}
    </ul>
  );
}

/**
 * Whether the course fits the visitor, in the course's own words, read as where they start and
 * where they get to: who it's for, then what it makes them able to do, side by side from `lg` (an
 * arrow from one to the other), a stop of the course's route named by the first. Flat on the page,
 * no panel: it's about the course, while the question above is a piece of the product. Nothing
 * when the course has neither.
 */
export async function CourseFit({
  className,
  content,
  courseId,
}: {
  className?: string;
  /** The course's landing copy, as the details step writes it; null before it's written. */
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
      <RouteStop aria-labelledby={outcomesId} className={cn("flex flex-col gap-5", className)}>
        <RouteTitle down id={outcomesId}>
          {t("What you'll be able to do")}
        </RouteTitle>
        <div className="max-w-column">
          <OutcomeList outcomes={outcomes} />
        </div>
      </RouteStop>
    );
  }

  return (
    <RouteStop
      aria-labelledby={audienceId}
      className={cn(
        "grid grid-cols-1 gap-x-16 gap-y-5",
        outcomes.length > 0 && "lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:grid-rows-[auto_1fr]",
        className,
      )}
    >
      <RouteTitle down id={audienceId}>
        {t("Who it's for")}
      </RouteTitle>

      <ul className="max-w-column flex flex-col lg:row-start-2">
        {audience.map((item) => (
          <li
            className="border-border py-3 text-[0.9375rem] leading-relaxed text-pretty not-first:border-t first:pt-0"
            key={item}
          >
            {item}
          </li>
        ))}
      </ul>

      {outcomes.length > 0 && (
        <section
          aria-labelledby={outcomesId}
          className="max-w-column mt-6 flex flex-col gap-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0"
        >
          <h2
            className="flex items-center gap-2 text-[0.9375rem] leading-relaxed font-semibold lg:min-h-6.5"
            id={outcomesId}
          >
            <ArrowRightIcon aria-hidden="true" className="text-muted-foreground size-4" />
            {t("What you'll be able to do")}
          </h2>

          <OutcomeList outcomes={outcomes} />
        </section>
      )}
    </RouteStop>
  );
}
