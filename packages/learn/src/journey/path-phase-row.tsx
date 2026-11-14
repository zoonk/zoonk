"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { StatusMark } from "../_components/status-mark";
import { useIsoToday } from "../_utils/iso-date";
import { usePlanScreen } from "../plan/plan-context";
import { useFormatPlanDate } from "../plan/plan-date-text";
import { usePhaseName } from "../plan/use-phase-name";
import { useShortDays } from "../plan/use-short-plan";
import { CurrentPhaseMark } from "./current-phase-mark";
import { useRoadmapFinish } from "./use-roadmap";

const TRAILING_CLASS =
  "text-muted-foreground text-right font-mono text-xs tabular-nums stacked:text-left";

export function PhaseLessons({ phase }: { phase: PlanPhaseView }) {
  const t = useExtracted();

  if (phase.lessonsTotal === 0 || phase.state !== "current") {
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

  const learns = phase.kind === "learn" || phase.kind === "afterExam";

  if (learns && phase.state === "upcoming") {
    const month = formatPlanDate(phase.endDate, { month: true });

    return (
      <span className={TRAILING_CLASS}>
        <span aria-hidden="true">
          {t({
            description: '{date} is a month, like "Jan" or "Jan 2028", never a day.',
            message: "until ~{date}",
            values: { date: month },
          })}
        </span>
        <span className="sr-only">
          {t({
            description: '{date} is a month, like "Jan" or "Jan 2028", never a day.',
            message: "until about {date}",
            values: { date: month },
          })}
        </span>
      </span>
    );
  }

  const date = formatPlanDate(phase.endDate);

  // The phase ends with its challenge, which has no booked day, only the plan's estimate.
  if (learns && phase.checkpoint?.state === "upcoming") {
    return (
      <span className={TRAILING_CLASS}>
        <span aria-hidden="true">
          {t({
            description: '{date} is a day, like "Nov 10".',
            id: "phaseUntilAboutDay",
            message: "until ~{date}",
            values: { date },
          })}
        </span>
        <span className="sr-only">
          {t({
            description: '{date} is a day, like "Nov 10".',
            id: "phaseUntilAboutDaySpoken",
            message: "until about {date}",
            values: { date },
          })}
        </span>
      </span>
    );
  }

  return <span className={TRAILING_CLASS}>{t("until {date}", { date })}</span>;
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
  const today = useIsoToday();

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
        : t({
            description: 'When this phase continues. {date} is a day, like "May 5".',
            message: "Continues {date}",
            values: { date: formatPlanDate(resumes) },
          })}
    </span>
  );
}

function isLeftOut(phase: PlanPhaseView): boolean {
  return phase.state === "leftOut" || phase.state === "unfinished" || phase.challengeLeftOut;
}

function PhaseLeftOut({ phase }: { phase: PlanPhaseView }) {
  const t = useExtracted();
  const { goal } = usePlanScreen();
  const lessons = phase.lessonsTotal - phase.lessonsDone;

  if (phase.state === "leftOut") {
    return <span className="text-muted-foreground text-xs">{t("Not in your plan")}</span>;
  }

  if (phase.state === "unfinished" && lessons > 0) {
    return (
      <span className="text-muted-foreground text-xs">
        {t("{count, plural, one {# lesson not studied} other {# lessons not studied}}", {
          count: lessons,
        })}
      </span>
    );
  }

  return (
    <span className="text-muted-foreground text-xs">
      {goal.kind === "language"
        ? t("The call isn't in your plan")
        : t("The Trickster isn't in your plan")}
    </span>
  );
}

function PhaseMeta({ open, phase }: { open: boolean; phase: PlanPhaseView }) {
  if (isLeftOut(phase)) {
    return <PhaseLeftOut phase={phase} />;
  }

  const lessonsLeft = phase.lessonsDone < phase.lessonsTotal;

  return phase.state === "current" && !open && lessonsLeft ? <PhaseResume phase={phase} /> : null;
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
            <span className="in-data-panel-open:hidden">{name}</span>
            <span className="hidden in-data-panel-open:inline">
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
