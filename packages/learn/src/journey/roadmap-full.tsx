"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { Popover, PopoverContent, PopoverTrigger } from "@zoonk/ui/components/popover";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindDot } from "../_components/kind-tile";
import { getPhaseWeight, getShareInPhase } from "../plan/phase-weight";
import { usePlanScreen } from "../plan/plan-context";
import { type JourneyPathLinks } from "./journey-links";
import { usePhaseLabel } from "./path-phase-row";
import { PhaseDetails } from "./phase-details";
import { BandFace } from "./roadmap-band";
import { PhaseAxis, PhaseLane } from "./roadmap-lane";
import { BAND_CLASS, BAND_STATE_CLASS } from "./roadmap-styles";
import { useRoadmapFinish, useRoadmapPhases, useRoadmapPosition } from "./use-roadmap";

const PERCENT = 100;

const ROADMAP_TITLE_ID = "plan-roadmap-title";

function moveBetweenBands(event: React.KeyboardEvent<HTMLOListElement>) {
  if (event.key !== "ArrowRight" && event.key !== "ArrowLeft") {
    return;
  }

  const bands = [...event.currentTarget.querySelectorAll("[data-slot=roadmap-band]")];
  const active = document.activeElement;
  const index = active ? bands.indexOf(active) : -1;

  if (index === -1) {
    return;
  }

  event.preventDefault();
  const next = event.key === "ArrowRight" ? index + 1 : index - 1;
  const band = bands[Math.min(bands.length - 1, Math.max(0, next))];

  if (band instanceof HTMLElement) {
    band.focus();
  }
}

function PhaseBand({
  focusable,
  links,
  phase,
}: {
  focusable: boolean;
  links: JourneyPathLinks;
  phase: PlanPhaseView;
}) {
  const label = usePhaseLabel();

  return (
    <Popover>
      <PopoverTrigger
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
        <BandFace phase={phase} />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="max-h-[min(60vh,28rem)] w-80 gap-3 overflow-y-auto"
        side="bottom"
      >
        <PhaseDetails links={links} phase={phase} />
      </PopoverContent>
    </Popover>
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
    <li
      className="@container/phase relative flex min-w-16 basis-0 flex-col transition-[flex-grow] duration-150 ease-out motion-reduce:transition-none"
      style={{ flexGrow: getPhaseWeight(phase) }}
    >
      <PhaseBand focusable={focusable} links={links} phase={phase} />

      {todayShare !== null && (
        <>
          <span
            aria-hidden="true"
            className="bg-foreground absolute -top-1.5 h-1.5 w-[1.5px]"
            style={{ left: `${todayShare * PERCENT}%` }}
          />
          <span
            aria-hidden="true"
            className="bg-foreground absolute top-8 h-1.5 w-[1.5px]"
            style={{ left: `${todayShare * PERCENT}%` }}
          />
        </>
      )}

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
      className="text-muted-foreground ml-auto hidden shrink-0 items-center gap-3 text-[0.71875rem] @xl/roadmap:flex"
    >
      {hasMocks && (
        <span className="flex items-center gap-1.5">
          <KindDot className="size-1.5" kind="mock" />
          {t("Mock exam")}
        </span>
      )}
      {hasChallenges && (
        <span className="flex items-center gap-1.5">
          <Trickster className="size-3.5" />
          {t("Phase challenge")}
        </span>
      )}
      {finish && (
        <span className="flex items-center gap-1.5">
          <FlagIcon className="size-3.5" />
          {goal.kind === "exam" ? t("Exam day") : t("Goal date")}
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
      <span className="font-medium">{position.name}</span>
      <span className="text-muted-foreground font-mono tabular-nums">
        {[position.day, position.place].filter(Boolean).map((part) => ` · ${part}`)}
      </span>
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
      <ol className="flex gap-[3px]" onKeyDown={moveBetweenBands}>
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
