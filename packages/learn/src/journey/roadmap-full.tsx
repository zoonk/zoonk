"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { Drawer, DrawerPopup, DrawerTrigger } from "@zoonk/ui/components/drawer";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindDot } from "../_components/kind-tile";
import { moveFocusWithArrows } from "../_utils/arrow-focus";
import { getPhaseWeight, getShareInPhase } from "../plan/phase-weight";
import { usePlanScreen } from "../plan/plan-context";
import { type JourneyPathLinks } from "./journey-links";
import { PhaseCheckpointMark } from "./journey-phase-events";
import { usePhaseLabel } from "./path-phase-row";
import { PhaseDetails } from "./phase-details";
import { usePhaseEndSpoken } from "./phase-when";
import { BandFace } from "./roadmap-band";
import { PhaseAxis, PhaseLane, TodayTick } from "./roadmap-lane";
import {
  BAND_CLASS,
  BAND_COLUMN_CLASS,
  BAND_ROWS_CLASS,
  BAND_STATE_CLASS,
  getBandColumnsStyle,
} from "./roadmap-styles";
import { useBandFit } from "./use-band-fit";
import {
  useAxisDatedPhases,
  useRoadmapFinish,
  useRoadmapPhases,
  useRoadmapPosition,
} from "./use-roadmap";

const ROADMAP_TITLE_ID = "plan-roadmap-title";

const moveBetweenBands = moveFocusWithArrows("roadmap-band");

function PhaseBand({
  focusable,
  isLast,
  links,
  phase,
  todayShare,
}: {
  focusable: boolean;
  isLast: boolean;
  links: JourneyPathLinks;
  phase: PlanPhaseView;
  todayShare: number | null;
}) {
  const label = usePhaseLabel();
  const endSpoken = usePhaseEndSpoken();

  return (
    <Drawer>
      <DrawerTrigger
        render={
          <button
            aria-current={phase.state === "current" ? "step" : undefined}
            aria-label={[label(phase), endSpoken(phase)].filter(Boolean).join(", ")}
            className={cn(
              BAND_CLASS,
              BAND_STATE_CLASS[phase.state],
              "focus-visible:ring-ring/50 hit-area held-pressed:brightness-90 dark:held-pressed:brightness-125 cursor-pointer transition-[filter] outline-none hover:brightness-95 focus-visible:ring-[3px] dark:hover:brightness-125",
            )}
            data-slot="roadmap-band"
            tabIndex={focusable ? 0 : -1}
            type="button"
          />
        }
      >
        <BandFace isLast={isLast} phase={phase} todayShare={todayShare} />
      </DrawerTrigger>

      <DrawerPopup>
        <PhaseDetails links={links} phase={phase} />
      </DrawerPopup>
    </Drawer>
  );
}

function PhaseColumn({
  focusable,
  isLast,
  labelled,
  links,
  phase,
  todayShare,
}: {
  focusable: boolean;
  isLast: boolean;
  labelled: boolean;
  links: JourneyPathLinks;
  phase: PlanPhaseView;
  todayShare: number | null;
}) {
  return (
    <li className={BAND_COLUMN_CLASS}>
      <TodayTick share={todayShare} />
      <PhaseBand
        focusable={focusable}
        isLast={isLast}
        links={links}
        phase={phase}
        todayShare={todayShare}
      />

      <PhaseLane isLast={isLast} phase={phase} />
      <PhaseAxis isLast={isLast} labelled={labelled} phase={phase} />
    </li>
  );
}

function useFinishLabel() {
  const t = useExtracted();
  const { goal, plan } = usePlanScreen();

  if (goal.kind === "exam") {
    return t("Exam date");
  }

  return plan.schedule.targetDate
    ? t("End date")
    : t({
        description:
          "In the roadmap's legend, beside the flag at the day the plan finishes when the learner set no end date.",
        message: "You finish",
      });
}

function RoadmapLegend() {
  const t = useExtracted();
  const { goal } = usePlanScreen();
  const finishLabel = useFinishLabel();
  const { phases } = useRoadmapPhases();
  const finish = useRoadmapFinish();
  const hasMocks = phases.some((phase) => phase.mocks.nextDate !== null);
  const hasChallenges = phases.some((phase) => phase.checkpoint?.date);

  return (
    <span
      aria-hidden="true"
      className="text-muted-foreground text-2xs ml-auto hidden shrink-0 items-center gap-3 @xl/roadmap:flex"
    >
      {hasMocks && (
        <span className="flex items-center gap-1.5">
          <KindDot className="size-1.5" kind="mock" />
          {t("Mock exam")}
        </span>
      )}
      {hasChallenges && (
        <span className="flex items-center gap-1.5">
          <PhaseCheckpointMark />
          {goal.kind === "language"
            ? t("Call")
            : t({
                description:
                  "In the plan timeline's legend, beside the mark of a phase's challenge: questions on that phase, with no hints. Use the same word for questions as the path row 'Questions on this phase, with no hints'.",
                message: "Phase questions",
              })}
        </span>
      )}
      {finish && (
        <span className="flex items-center gap-1.5">
          <FlagIcon className="size-3.5" />
          {finishLabel}
        </span>
      )}
    </span>
  );
}

function RoadmapPosition() {
  const position = useRoadmapPosition();

  if (!position) {
    return null;
  }

  // The band under it names the phase, so the line says only where the learner is.
  return <p className="min-w-0 truncate text-xs font-medium">{position.place}</p>;
}

export function RoadmapFull({ className, links }: { className?: string; links: JourneyPathLinks }) {
  const t = useExtracted();
  const { currentIndex, phases, today } = useRoadmapPhases();
  const axisDated = useAxisDatedPhases();
  const focusIndex = Math.max(0, currentIndex);
  const { listRef, widthRef } = useBandFit();

  return (
    <section
      aria-labelledby={ROADMAP_TITLE_ID}
      className={cn("@container/roadmap relative flex flex-col gap-2.5", className)}
      data-slot="plan-roadmap"
    >
      <span aria-hidden="true" className="absolute inset-x-0 top-0 h-0" ref={widthRef} />

      <div className="flex items-center justify-between gap-4">
        <h2 className="sr-only" id={ROADMAP_TITLE_ID}>
          {t("Phases")}
        </h2>
        <RoadmapPosition />
        <RoadmapLegend />
      </div>

      {/* oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- The arrow keys move between the buttons inside. */}
      <ol
        className={cn(
          BAND_ROWS_CLASS,
          "grid-rows-[repeat(4,auto)] transition-[grid-template-columns] duration-150 ease-out motion-reduce:transition-none",
        )}
        onKeyDown={moveBetweenBands}
        ref={listRef}
        style={getBandColumnsStyle(phases.map((phase) => getPhaseWeight(phase)))}
      >
        {phases.map((phase, position) => {
          const isCurrent = position === currentIndex;

          return (
            <PhaseColumn
              focusable={position === focusIndex}
              isLast={position === phases.length - 1}
              key={phase.index}
              labelled={axisDated.has(phase.index)}
              links={links}
              phase={phase}
              todayShare={isCurrent ? getShareInPhase({ at: "start", date: today, phase }) : null}
            />
          );
        })}
      </ol>
    </section>
  );
}
