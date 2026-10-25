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

/** A row's lessons or date at its end, in the mono face. */
const TRAILING_CLASS =
  "text-muted-foreground shrink-0 text-right font-mono text-xs whitespace-nowrap tabular-nums";

/**
 * "1 / 4": a phase's lessons done of its lessons, heard as words, in a column wide enough for most
 * counts so the phases' dates line up, growing for a long one.
 */
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

/**
 * When a phase ends, at its row's end: "until Dec 25", an estimate ahead "until ~Jan" (heard as
 * "until about Jan"), a short plan's days. Nothing for a done phase, nor for the last one, whose
 * end the finish says.
 */
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

/**
 * A phase's mark: a check once done, a dark dot for the current phase, a faint dot ahead,
 * whatever the path opens. Work set aside never gets a check.
 */
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

/**
 * Under a phase's name, why it reads as it does: the current one, closed while the next chapter is
 * in a later phase, says when its lessons continue, whether they're still being written, or when
 * its challenge comes once its lessons are done; one moved past with work set aside, how many of its
 * lessons were left out (its lessons done are at the row's end), as the plan's end says it; one
 * the plan holds nothing of, that it isn't in the plan.
 */
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

    // Its lessons all done, only its challenge was set aside.
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

  // The path opens at the next chapter, while this phase says when its remaining lessons resume.
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

/** What screen readers hear after a phase's name: ", you are here" or ", done". */
function usePhaseState() {
  const t = useExtracted();

  return (phase: Pick<PlanPhaseView, "state">): string => {
    if (phase.state === "current") {
      return t(", you are here");
    }

    return phase.state === "done" ? t(", done") : "";
  };
}

/**
 * A phase's name and state in one run ("Phase 3, you are here"), to name the row or band it's on,
 * as a mission's row is named: from its words, a browser reads the hidden state as a block of its
 * own and named the row "Phase 3 , you are here". `byPlace` as in `PhaseName`.
 */
export function usePhaseLabel() {
  const t = useExtracted();
  const phaseName = usePhaseName();
  const phaseState = usePhaseState();
  const { plan } = usePlanScreen();

  return (phase: PlanPhaseView, { byPlace = false, isNext = false } = {}): string => {
    const name = phaseName(phase, { byPlace, mocksRequirePlus: plan.access.mocksRequirePlus });

    if (isNext && phase.state !== "current") {
      return `${name}${t(", up next")}`;
    }

    return `${name}${phaseState(phase)}`;
  };
}

/**
 * A phase's name, with what screen readers need to hear about its state, and what it waits for
 * under it (in `metaId`, for a row named by `usePhaseLabel` to be described by). Open over
 * chapters one of which has its name (`byPlace`, see `isNamedLikeAChapter`), it goes by its place
 * while its chapters show, so that chapter carries the name; closed, it keeps it.
 */
export function PhaseName({
  byPlace = false,
  metaId,
  open,
  phase,
}: {
  byPlace?: boolean;
  metaId?: string;
  open: boolean;
  phase: PlanPhaseView;
}) {
  const phaseName = usePhaseName();
  const phaseState = usePhaseState();
  const { plan } = usePlanScreen();
  const name = phaseName(phase, { mocksRequirePlus: plan.access.mocksRequirePlus });
  const state = phaseState(phase);

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
      <span className="contents" id={metaId}>
        <PhaseMeta open={open} phase={phase} />
      </span>
    </span>
  );
}
