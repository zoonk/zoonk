"use client";

import { type LanguageProgressView } from "@zoonk/core/view-models/language/contract";
import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { SectionLabel } from "../_components/section-label";
import { LearnLink } from "../learn-link";
import { UnitBadge, UnitLessonsBar } from "./unit-parts";

type CurrentUnit = NonNullable<LanguageProgressView["currentUnit"]>;

/** A tappable row of the language screens: muted in Focus, glass in Fun. */
export const LANGUAGE_ROW_LINK_CLASS = cn(
  "bg-muted/60 hover:bg-muted focus-visible:ring-ring/50 flex min-h-14 items-center gap-3 rounded-2xl p-3 outline-none focus-visible:ring-[3px]",
  "in-data-[mode=fun]:fun-glass",
);

/**
 * "Your current situation": the unit the learner is in, how many of its lessons are done, and the
 * way to its page. Today and Progress show the same row.
 */
export function CurrentUnitSection({ href, unit }: { href: string; unit: CurrentUnit }) {
  const t = useExtracted();

  return (
    <section aria-labelledby="language-current-unit" className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        <SectionLabel id="language-current-unit">{t("Your current situation")}</SectionLabel>
        <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
          {t("Unit {position, number} of {units, number}", {
            position: unit.position,
            units: unit.units,
          })}
        </span>
      </div>

      <LearnLink className={LANGUAGE_ROW_LINK_CLASS} href={href}>
        <UnitBadge position={unit.position} />
        <span className="flex min-w-0 flex-1 flex-col gap-2">
          <span className="truncate font-medium">{unit.title}</span>
          <UnitLessonsBar done={unit.lessonsDone} total={unit.lessonsTotal} />
        </span>
        <ChevronRightIcon aria-hidden="true" className="text-muted-foreground size-4 shrink-0" />
      </LearnLink>
    </section>
  );
}
