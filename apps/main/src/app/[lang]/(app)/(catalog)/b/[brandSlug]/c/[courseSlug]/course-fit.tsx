import { ShowMore } from "@/components/catalog/show-more";
import { CheckMark } from "@/components/public/check-mark";
import { type CourseLandingPageContent } from "@zoonk/core/courses/landing-page";
import { SURFACE_CLASS } from "@zoonk/learn/surface";
import { LineMarker } from "@zoonk/ui/components/line-marker";
import { cn } from "@zoonk/ui/lib/utils";
import { ArrowDownIcon, ArrowRightIcon } from "lucide-react";
import { getExtracted } from "next-intl/server";

/** How many outcomes show before the rest wait one tap away. */
const OUTCOMES_SHOWN = 3;

const LIST_CLASS = "flex flex-col gap-3";

/** Outcomes after a tick, each something the course makes the visitor able to do. */
function OutcomeItems({ items }: { items: string[] }) {
  return (
    <ul className={LIST_CLASS}>
      {items.map((item) => (
        <li className="flex gap-3 text-[0.9375rem] leading-snug" key={item}>
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
 * What the course makes someone able to do, its first steps first (the details step writes them
 * in that order): the first few in sight, the rest one tap away. Folding a single one would only
 * hide one line, so a list one longer than that shows whole.
 */
async function Outcomes({ id, outcomes }: { id: string; outcomes: string[] }) {
  const t = await getExtracted();
  const rest = outcomes.length - OUTCOMES_SHOWN;

  return (
    <section
      aria-labelledby={id}
      className={cn(SURFACE_CLASS, "max-w-column flex flex-col gap-4 p-5 sm:p-7")}
    >
      <h2 className="text-label" id={id}>
        {t("What you'll be able to do")}
      </h2>

      {rest > 1 ? (
        <div className={LIST_CLASS}>
          <OutcomeItems items={outcomes.slice(0, OUTCOMES_SHOWN)} />

          <ShowMore
            className="ml-8"
            less={t("Show fewer")}
            more={t("{count, plural, one {Show # more} other {Show # more}}", { count: rest })}
          >
            <OutcomeItems items={outcomes.slice(OUTCOMES_SHOWN)} />
          </ShowMore>
        </div>
      ) : (
        <OutcomeItems items={outcomes} />
      )}
    </section>
  );
}

/**
 * Whether the course fits the visitor, in the course's own words, read as where they start and
 * where they get to: who it's for, then what it makes them able to do, an arrow from one to the
 * other, side by side from `lg`. Flat on the page: it's about the course, while the question and
 * the plan beside and above it are pieces of the product, in their panels. Nothing when the course
 * has neither.
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

  const hasBoth = audience.length > 0 && outcomes.length > 0;
  const audienceId = `course-audience-${courseId}`;

  return (
    <div
      className={cn(
        "grid grid-cols-1 gap-6",
        hasBoth && "lg:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] lg:gap-x-10",
        className,
      )}
    >
      {audience.length > 0 && (
        <section aria-labelledby={audienceId} className="max-w-column flex flex-col gap-4">
          <h2 className="text-label" id={audienceId}>
            {t("Who it's for")}
          </h2>

          <ul className={LIST_CLASS}>
            {audience.map((item) => (
              <li
                className="text-muted-foreground text-[0.9375rem] leading-snug text-pretty"
                key={item}
              >
                {item}
              </li>
            ))}
          </ul>
        </section>
      )}

      {hasBoth && (
        <span aria-hidden="true" className="text-faint flex lg:items-center">
          <ArrowDownIcon className="size-5 lg:hidden" />
          <ArrowRightIcon className="hidden size-5 lg:block" />
        </span>
      )}

      {outcomes.length > 0 && <Outcomes id={`course-outcomes-${courseId}`} outcomes={outcomes} />}
    </div>
  );
}
