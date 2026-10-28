"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { StatusMark } from "../_components/status-mark";
import { toLocalIsoDate } from "../_utils/iso-date";
import { usePlanScreen } from "../plan/plan-context";
import { useFormatPlanDate } from "../plan/plan-date-text";
import { usePhaseName } from "../plan/use-phase-name";
import { useShortDays } from "../plan/use-short-plan";
import { CurrentPhaseMark } from "./current-phase-mark";
import { useRoadmapFinish } from "./use-roadmap";

const TRAILING_CLASS =
  "text-muted-foreground shrink-0 text-right font-mono text-xs whitespace-nowrap tabular-nums";

export function PhaseLessons({ phase }: { phase: PlanPhaseView }) {
  const t = useExtracted();

  if (phase.lessonsTotal === 0) {
    return null;
  }

  return (
    <span className={cn(TRAILING_CLASS, "min-w-14")}>
      <span aria-hidden="true">
        {t("{done, number} / {total, number}", {
          done: phase.lessonsDone,
          total: phase.lessonsTotal,
        })}
      </span>
      <span className="sr-only">
        {t(
          "{total, plural, one {{done, number} of # lesson done} other {{done, number} of # lessons done}}",
          { done: phase.lessonsDone, total: phase.lessonsTotal },
        )}
      </span>
    </span>
  );
}

export function PhaseUntil({ isLast, phase }: { isLast: boolean; phase: PlanPhaseView }) {
  const t = useExtracted();
  const shortDays = useShortDays();
  const formatPlanDate = useFormatPlanDate();
  const finish = useRoadmapFinish();
  const days = shortDays(phase.short);

  if (days) {
    return <span className={cn(TRAILING_CLASS, "font-sans")}>{days}</span>;
  }

  if (
    phase.state === "done" ||
    phase.state === "unfinished" ||
    phase.state === "leftOut" ||
    !phase.endDate
  ) {
    return null;
  }

  if (isLast && phase.kind !== "afterExam" && finish) {
    return null;
  }

  const estimate =
    (phase.kind === "learn" || phase.kind === "afterExam") && phase.state === "upcoming";

  const date = formatPlanDate(phase.endDate, { month: estimate });

  if (!estimate) {
    return <span className={TRAILING_CLASS}>{t("until {date}", { date })}</span>;
  }

  return (
    <span className={TRAILING_CLASS}>
      <span aria-hidden="true">{t("until ~{date}", { date })}</span>
      <span className="sr-only">{t("until about {date}", { date })}</span>
    </span>
  );
}

export function PhaseMark({ phase }: { phase: PlanPhaseView }) {
  if (phase.state === "done") {
    return <StatusMark status="done" />;
  }

  if (phase.state === "current") {
    return (
      <span aria-hidden="true" className="flex size-4 shrink-0 items-center justify-center">
        <CurrentPhaseMark />
      </span>
    );
  }

  return <StatusMark status="todo" />;
}

function PhaseResume({ phase }: { phase: PlanPhaseView }) {
  const t = useExtracted();
  const formatPlanDate = useFormatPlanDate();
  const today = toLocalIsoDate(useMountTime());

  const resumes = phase.chapters
    .filter((chapter) => chapter.state !== "done")
    .flatMap((chapter) => chapter.nextDate ?? [])
    .toSorted()[0];

  if (!resumes) {
    return null;
  }

  return (
    <span className="text-muted-foreground text-xs">
      {resumes === today
        ? t("Continues today")
        : t("Continues {date}", { date: formatPlanDate(resumes) })}
    </span>
  );
}

function PhaseMeta({ open, phase }: { open: boolean; phase: PlanPhaseView }) {
  const t = useExtracted();
  const formatPlanDate = useFormatPlanDate();

  const challengeDate =
    phase.checkpoint?.state === "upcoming" && phase.checkpoint.when === "date"
      ? phase.checkpoint.date
      : null;

  const writing = phase.chapters.some((chapter) => chapter.writing);

  if (phase.state === "leftOut") {
    return <span className="text-muted-foreground text-xs">{t("Not in your plan")}</span>;
  }

  if (phase.state === "unfinished") {
    const leftOut = phase.lessonsTotal - phase.lessonsDone;

    return (
      <span className="text-muted-foreground text-xs">
        {leftOut > 0
          ? t("{count, plural, one {# lesson was left out} other {# lessons were left out}}", {
              count: leftOut,
            })
          : t("Challenge left out")}
      </span>
    );
  }

  const lessonsLeft = phase.lessonsDone < phase.lessonsTotal;

  if (phase.state !== "current" || open) {
    return null;
  }

  if (!writing && lessonsLeft) {
    return <PhaseResume phase={phase} />;
  }

  const date = challengeDate && formatPlanDate(challengeDate);

  if (!writing && !date) {
    return null;
  }

  return (
    <span className="text-muted-foreground text-xs">
      {writing && date && t("More lessons on the way · challenge {date}", { date })}
      {writing && !date && t("More lessons on the way")}
      {!writing && date && t("Lessons done · challenge {date}", { date })}
    </span>
  );
}

function usePhaseState() {
  const t = useExtracted();

  return (phase: Pick<PlanPhaseView, "state">, { isNext = false } = {}): string => {
    if (phase.state === "current") {
      return t(", you are here");
    }

    if (isNext) {
      return t(", up next");
    }

    return phase.state === "done" ? t(", done") : "";
  };
}

/**
 * One run of words: a browser reads hidden text as its own block, so a band named from its parts
 * read "Phase 3 , you are here".
 */
export function usePhaseLabel() {
  const phaseName = usePhaseName();
  const phaseState = usePhaseState();
  const { plan } = usePlanScreen();

  return (phase: PlanPhaseView): string =>
    `${phaseName(phase, { mocksRequirePlus: plan.access.mocksRequirePlus })}${phaseState(phase)}`;
}

export function PhaseName({
  byPlace = false,
  isNext = false,
  open,
  phase,
}: {
  byPlace?: boolean;
  isNext?: boolean;
  open: boolean;
  phase: PlanPhaseView;
}) {
  const phaseName = usePhaseName();
  const phaseState = usePhaseState();
  const { plan } = usePlanScreen();
  const name = phaseName(phase, { mocksRequirePlus: plan.access.mocksRequirePlus });
  const state = phaseState(phase, { isNext });

  return (
    <span className="flex min-w-0 flex-1 flex-col">
      <span className={cn("font-medium", phase.state === "done" && "text-muted-foreground")}>
        {byPlace ? (
          <>
            <span className="group-data-panel-open/phase:hidden">{name}</span>
            <span className="hidden group-data-panel-open/phase:inline">
              {phaseName(phase, { byPlace })}
            </span>
          </>
        ) : (
          name
        )}
        {state && <span className="sr-only">{state}</span>}
      </span>
      <PhaseMeta open={open} phase={phase} />
    </span>
  );
}
