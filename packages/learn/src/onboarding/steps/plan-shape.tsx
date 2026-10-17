"use client";

import { type SyllabusView } from "@zoonk/core/view-models/syllabus/contract";
import { useExtracted, useFormatter } from "next-intl";
import { SectionLabel } from "../../_components/section-label";
import { getChapterKey, isWritingAhead, useChapterTitle } from "../../journey/journey-chapters";
import { PlanRoadmap } from "../../journey/plan-roadmap";
import { usePlanScreen } from "../../plan/plan-context";

/** How many rows the reveal's lists show (areas, chapters); the Plan has the rest. */
const ROWS_SHOWN = 5;

/** The phases the reveal draws: the plan's own, not what goes on after an exam. */
function useRevealPhases() {
  const { plan } = usePlanScreen();
  return plan.phases.filter((phase) => phase.kind !== "afterExam");
}

/**
 * The plan's phases on one line, each as long as its time, the current one raised, with the day
 * each one starts under it and the goal's date at the end: the Plan's roadmap in its reveal
 * density, so the same plan is drawn the same way a minute later on the Plan. A plan of one phase
 * has nothing to draw: its chapters say its shape instead (`PlanChapterList`).
 */
export function PlanPhasesBar() {
  const t = useExtracted();
  const phases = useRevealPhases();

  if (phases.length < 2) {
    return null;
  }

  return (
    <section aria-labelledby="plan-phases" className="flex flex-col gap-2.5">
      <SectionLabel id="plan-phases">{t("Phases")}</SectionLabel>
      <PlanRoadmap density="reveal" />
    </section>
  );
}

/**
 * The plan's shape when it has no phases to draw (a course plan of one phase): its chapters in
 * order as a quiet numbered list, named as the Plan names them, the first few with a count of the
 * rest, so every learner sees what their plan holds before starting. Lessons still being written
 * ahead aren't chapters yet, so they're left out, as the Plan says them in a line of their own.
 */
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
      <SectionLabel id="plan-chapters">{t("Chapters")}</SectionLabel>

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

/**
 * What each area of the exam weighs, every one its source names (a notice's Redação too), the
 * heaviest first: a dot, the area, a thin bar of its share of the whole and its percentage in the
 * mono face. The percentages are core's (`displayWeight`), which add up to 100; one its source
 * doesn't state is an estimate, marked "~" and said under the list, naming that source as the
 * syllabus does: the learner's own material is never called a notice. The full syllabus stays one
 * tap away under it.
 */
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
      <SectionLabel id="plan-weights">{t("Weight by area")}</SectionLabel>

      <ul className="flex flex-col [&>li+li]:border-t">
        {weighed.map((area) => (
          <li className="flex min-h-11 items-center gap-3 py-2" key={area.key}>
            <span
              aria-hidden="true"
              className="bg-muted-foreground size-1.5 shrink-0 rounded-full"
            />
            <span className="min-w-0 flex-1 text-sm font-medium text-pretty">{area.name}</span>
            <span aria-hidden="true" className="bg-surface-3 h-1 w-20 shrink-0 rounded-xs sm:w-36">
              <span
                className="bg-foreground block h-full rounded-xs"
                style={{ width: `${area.weight.share * 100}%` }}
              />
            </span>
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
