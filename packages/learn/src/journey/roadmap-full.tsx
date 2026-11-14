"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { Drawer, DrawerPopup, DrawerTrigger } from "@zoonk/ui/components/drawer";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindDot } from "../_components/kind-tile";
import { moveFocusWithArrows } from "../_utils/arrow-focus";
import { getPhaseWeight, getShareInPhase } from "../plan/phase-weight";
import { usePlanScreen } from "../plan/plan-context";
import { type JourneyPathLinks } from "./journey-links";
import { usePhaseLabel } from "./path-phase-row";
import { PhaseDetails } from "./phase-details";
import { BandFace } from "./roadmap-band";
import { PhaseAxis, PhaseLane } from "./roadmap-lane";
import {
  BAND_CLASS,
  BAND_COLUMN_CLASS,
  BAND_ROWS_CLASS,
  BAND_STATE_CLASS,
  getBandColumnsStyle,
} from "./roadmap-styles";
import { useRoadmapFinish, useRoadmapPhases, useRoadmapPosition } from "./use-roadmap";

const PERCENT = 100;

const ROADMAP_TITLE_ID = "plan-roadmap-title";

const moveBetweenBands = moveFocusWithArrows("roadmap-band");

function TodayTicks({ share }: { share: number }) {
  const style = { left: `${share * PERCENT}%` };

  return (
    <>
      <span
        aria-hidden="true"
        className="bg-foreground absolute -top-1.5 h-1.5 w-[1.5px]"
        style={style}
      />
      <span
        aria-hidden="true"
        className="bg-foreground absolute top-full h-1.5 w-[1.5px]"
        style={style}
      />
    </>
  );
}

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

  return (
    <Drawer>
      <DrawerTrigger
        render={
          <button
            aria-current={phase.state === "current" ? "step" : undefined}
            aria-label={label(phase)}
            className={cn(
              BAND_CLASS,
              BAND_STATE_CLASS[phase.state],
              "focus-visible:ring-ring/50 hit-area cursor-pointer transition-[filter] outline-none hover:brightness-95 focus-visible:ring-[3px] dark:hover:brightness-125",
            )}
            data-slot="roadmap-band"
            tabIndex={focusable ? 0 : -1}
            type="button"
          />
        }
      >
        <BandFace isLast={isLast} phase={phase} />
        {todayShare !== null && <TodayTicks share={todayShare} />}
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
      <PhaseBand
        focusable={focusable}
        isLast={isLast}
        links={links}
        phase={phase}
        todayShare={todayShare}
      />

      <PhaseLane isLast={isLast} phase={phase} />
      <PhaseAxis isLast={isLast} labelled={labelled} phase={phase} todayShare={todayShare} />
    </li>
  );
}

function RoadmapLegend() {
  const t = useExtracted();
  const { goal } = usePlanScreen();
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
          <Trickster className="size-4" view="face" />
          {goal.kind === "language" ? t("Call") : t("The Trickster")}
        </span>
      )}
      {finish && (
        <span className="flex items-center gap-1.5">
          <FlagIcon className="size-3.5" />
          {goal.kind === "exam" ? t("Exam date") : t("End date")}
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

  return (
    <p className="min-w-0 truncate text-xs">
      <span className="font-medium">{position.place}</span>
      {position.name && <span className="text-muted-foreground">{` · ${position.name}`}</span>}
    </p>
  );
}

export function RoadmapFull({ className, links }: { className?: string; links: JourneyPathLinks }) {
  const t = useExtracted();
  const { currentIndex, phases, today } = useRoadmapPhases();
  const focusIndex = Math.max(0, currentIndex);

  return (
    <section
      aria-labelledby={ROADMAP_TITLE_ID}
      className={cn("@container/roadmap flex flex-col gap-2.5", className)}
      data-slot="plan-roadmap"
    >
      <div className="flex items-baseline justify-between gap-4">
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
          "grid-rows-[repeat(3,auto)] transition-[grid-template-columns] duration-150 ease-out motion-reduce:transition-none",
        )}
        onKeyDown={moveBetweenBands}
        style={getBandColumnsStyle(phases.map((phase) => getPhaseWeight(phase)))}
      >
        {phases.map((phase, position) => {
          const isCurrent = position === currentIndex;

          return (
            <PhaseColumn
              focusable={position === focusIndex}
              isLast={position === phases.length - 1}
              key={phase.index}
              labelled={currentIndex !== -1 && position > currentIndex}
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
