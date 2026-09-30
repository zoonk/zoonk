"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { roundedGap, yearsBetween } from "./timeline-scale";

type Dated = { label: string; year: number };

/** "About 2,500 years" once gaps are large enough to round, the exact count otherwise. */
function useGapText() {
  const t = useExtracted();

  return (years: number) => {
    const rounded = roundedGap(years);

    return rounded === years
      ? t("{count, plural, one {# year} other {# years}}", { count: years })
      : t("{count, plural, one {about # year} other {about # years}}", { count: rounded });
  };
}

/**
 * How far apart neighboring dates really are, once the real dates show, in the colors of the
 * spans on the axis. This is where "Cleopatra lived closer to the Moon landing" becomes visible.
 */
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
            <span className="text-muted-foreground">
              {t("from {earlier} ({earlierYear}) to {later} ({laterYear})", {
                earlier: earlier.label,
                earlierYear: formatYear(earlier.year),
                later: later.label,
                laterYear: formatYear(later.year),
              })}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
