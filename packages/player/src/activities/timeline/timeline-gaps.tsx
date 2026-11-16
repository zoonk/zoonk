"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ArrowRight } from "lucide-react";
import { useExtracted } from "next-intl";
import { roundedGap, yearsBetween } from "./timeline-scale";

type Dated = { label: string; year: number };

function useGapText() {
  const t = useExtracted();

  return (years: number) => {
    const rounded = roundedGap(years);

    return rounded === years
      ? t("{count, plural, one {# year} other {# years}}", { count: years })
      : t("{count, plural, one {about # year} other {about # years}}", { count: rounded });
  };
}

export function TimelineGaps({
  anchors,
  events,
  formatYear,
}: {
  anchors: readonly Dated[];
  events: readonly Dated[];
  formatYear: (year: number) => string;
}) {
  const t = useExtracted();
  const gapText = useGapText();
  const dated = [...anchors, ...events].toSorted((a, b) => a.year - b.year);
  const pairs = dated.slice(1).map((later, index) => ({ earlier: dated[index] ?? later, later }));

  return (
    <ul
      aria-label={t("Time between the dates")}
      className="flex flex-col gap-1.5 text-sm"
      data-slot="timeline-gaps"
    >
      {pairs.map(({ earlier, later }, index) => (
        <li className="flex items-start gap-2" key={`${earlier.label}-${later.label}`}>
          <span
            aria-hidden="true"
            className={cn(
              "mt-1.5 size-2.5 shrink-0 rounded-full",
              index % 2 === 0 ? "bg-viz-highlight" : "bg-viz-secondary",
            )}
          />
          <span>
            <span className="font-semibold tabular-nums">
              {gapText(yearsBetween(earlier.year, later.year))}
            </span>{" "}
            {/* An event's label is a title, not a clause, so the two are shown side by side, never in a sentence. */}
            <span className="text-muted-foreground">
              {t("{event} ({year})", { event: earlier.label, year: formatYear(earlier.year) })}
              <ArrowRight aria-hidden="true" className="mx-1.5 inline size-3.5 align-[-2px]" />
              <span className="sr-only">
                {t({
                  description:
                    "Read aloud by a screen reader between two events on a timeline, where sighted learners see an arrow: “Great Pyramid built (2560 BCE) to Moon landing (1969)”.",
                  message: "to",
                })}{" "}
              </span>
              {t("{event} ({year})", { event: later.label, year: formatYear(later.year) })}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
