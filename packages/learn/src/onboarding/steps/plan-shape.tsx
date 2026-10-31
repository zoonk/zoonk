"use client";

import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted, useFormatter } from "next-intl";
import { Meter, MeterFill } from "../../_components/meter";
import { PageSectionTitle } from "../../_components/page";
import { getChapterKey, isWritingAhead, useChapterTitle } from "../../journey/journey-chapters";
import { PlanRoadmap } from "../../journey/plan-roadmap";
import { usePlanScreen } from "../../plan/plan-context";

const ROWS_SHOWN = 5;

function useRevealPhases() {
  const { plan } = usePlanScreen();
  return plan.phases.filter((phase) => phase.kind !== "afterExam");
}

export function PlanPhasesBar() {
  const t = useExtracted();
  const phases = useRevealPhases();

  if (phases.length < 2) {
    return null;
  }

  return (
    <section aria-labelledby="plan-phases" className="flex flex-col gap-2.5">
      <PageSectionTitle id="plan-phases">{t("Phases")}</PageSectionTitle>
      <PlanRoadmap density="reveal" />
    </section>
  );
}

export function PlanChapterList() {
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
    <section aria-labelledby="plan-chapters" className="flex flex-col gap-1">
      <PageSectionTitle id="plan-chapters">{t("Chapters")}</PageSectionTitle>

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

export function AreaWeights({ syllabus }: { syllabus: SyllabusView | null }) {
  const t = useExtracted();
  const format = useFormatter();
  const formatPercent = (percent: number) => format.number(percent / 100, { style: "percent" });

  const weighed = (syllabus?.subjects ?? [])
    .flatMap((subject) =>
      subject.displayWeight
        ? [{ key: subject.key, name: subject.name, weight: subject.displayWeight }]
        : [],
    )
    .toSorted((a, b) => b.weight.share - a.weight.share);

  if (weighed.length < 2) {
    return null;
  }

  const assumed = weighed.filter((area) => area.weight.basis === "assumed").length;
  const source = syllabus?.fromMaterial ? "material" : (syllabus?.examDocument ?? "notice");

  return (
    <section aria-labelledby="plan-weights" className="flex flex-col gap-1">
      <PageSectionTitle id="plan-weights">{t("Weight by area")}</PageSectionTitle>

      <ul className="flex flex-col [&>li+li]:border-t">
        {weighed.map((area) => (
          <li className="flex min-h-11 items-center gap-3 py-2" key={area.key}>
            <span
              aria-hidden="true"
              className="bg-muted-foreground size-1.5 shrink-0 rounded-full"
            />
            <span className="min-w-0 flex-1 text-sm font-medium text-pretty">{area.name}</span>
            <Meter as="span" className="w-20 shrink-0 sm:w-36">
              <MeterFill as="span" share={area.weight.share} />
            </Meter>
            <span className="text-muted-foreground w-10 shrink-0 text-right font-mono text-xs tabular-nums">
              {area.weight.basis === "assumed"
                ? t("~{percent}", { percent: formatPercent(area.weight.percent) })
                : formatPercent(area.weight.percent)}
            </span>
          </li>
        ))}
      </ul>

      {assumed > 0 && (
        <p className="text-muted-foreground pt-1 text-xs text-pretty">
          {t(
            "{source, select, material {{count, plural, one {~ Estimated: your material doesn't say how much this area weighs.} other {~ Estimated: your material doesn't say how much these areas weigh.}}} guide {{count, plural, one {~ Estimated: the official guide doesn't say how much this area weighs.} other {~ Estimated: the official guide doesn't say how much these areas weigh.}}} other {{count, plural, one {~ Estimated: the notice doesn't say how much this area weighs.} other {~ Estimated: the notice doesn't say how much these areas weigh.}}}}",
            { count: assumed, source },
          )}
        </p>
      )}
    </section>
  );
}
