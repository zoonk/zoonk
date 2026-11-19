"use client";

import { useExtracted } from "next-intl";
import { useId } from "react";
import { PageSectionTitle } from "../../_components/page";
import { getChapterKey, isWritingAhead, useChapterTitle } from "../../journey/journey-chapters";
import { PlanRoadmap } from "../../journey/plan-roadmap";
import { usePlanScreen } from "../../plan/plan-context";

const ROWS_SHOWN = 5;

function useRevealPhases() {
  const { plan } = usePlanScreen();
  return plan.phases.filter((phase) => phase.kind !== "afterExam");
}

/** `stacked` lists the phases one per row, for a column too narrow for their band. */
export function PlanPhasesBar({ stacked = false }: { stacked?: boolean }) {
  const t = useExtracted();
  const titleId = useId();
  const phases = useRevealPhases();

  if (phases.length < 2) {
    return null;
  }

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-2.5">
      <PageSectionTitle id={titleId}>{t("Phases")}</PageSectionTitle>
      <PlanRoadmap density={stacked ? "revealList" : "reveal"} />
    </section>
  );
}

export function PlanChapterList() {
  const titleId = useId();
  const t = useExtracted();
  const title = useChapterTitle();
  const phases = useRevealPhases();

  const chapters = phases
    .flatMap((phase) => phase.chapters)
    .filter((chapter) => !isWritingAhead(chapter));

  if (phases.length >= 2 || chapters.length === 0) {
    return null;
  }

  const rest = chapters.length - ROWS_SHOWN;

  return (
    <section aria-labelledby={titleId} className="flex flex-col gap-1">
      <PageSectionTitle id={titleId}>{t("Chapters")}</PageSectionTitle>

      <ol className="flex flex-col [&>li+li]:border-t">
        {chapters.slice(0, ROWS_SHOWN).map((chapter, index) => (
          <li className="flex min-h-11 items-center gap-3 py-2" key={getChapterKey(chapter)}>
            <span
              aria-hidden="true"
              className="text-faint w-4 shrink-0 font-mono text-xs tabular-nums"
            >
              {index + 1}
            </span>
            <span className="min-w-0 flex-1 text-sm font-medium text-pretty">{title(chapter)}</span>
          </li>
        ))}
      </ol>

      {rest > 0 && (
        <p className="text-muted-foreground pt-1 text-xs">
          {t("{count, plural, one {# more chapter} other {# more chapters}}", { count: rest })}
        </p>
      )}
    </section>
  );
}
