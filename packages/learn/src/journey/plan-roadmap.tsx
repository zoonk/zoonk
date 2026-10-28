"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { ChevronRightIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { MeterPart, MeterParts } from "../_components/meter";
import { StatusMark } from "../_components/status-mark";
import { getPhaseWeight, getShareInPhase } from "../plan/phase-weight";
import { usePlanScreen } from "../plan/plan-context";
import { PlanDateText } from "../plan/plan-date-text";
import { usePhaseName } from "../plan/use-phase-name";
import { type JourneyPathLinks } from "./journey-links";
import { BandFace } from "./roadmap-band";
import { RoadmapFull } from "./roadmap-full";
import { PhaseAxis } from "./roadmap-lane";
import { BAND_CLASS, BAND_STATE_CLASS } from "./roadmap-styles";
import {
  getLessonShare,
  useRoadmapFinish,
  useRoadmapPhases,
  useRoadmapPosition,
} from "./use-roadmap";

const PERCENT = 100;

function RoadmapCompact({
  className,
  onOpen,
}: {
  className?: string;
  onOpen: (() => void) | null;
}) {
  const t = useExtracted();
  const { phases } = useRoadmapPhases();
  const position = useRoadmapPosition();

  const content = (
    <>
      <MeterParts as="span">
        {phases.map((phase) => (
          <MeterPart
            as="span"
            className={cn(
              "relative min-w-6 overflow-hidden",
              phase.state === "current" &&
                "after:ring-success after:absolute after:inset-0 after:rounded-[inherit] after:ring-[1.5px] after:ring-inset",
            )}
            key={phase.index}
            weight={getPhaseWeight(phase)}
          >
            <span
              className="bg-success absolute inset-y-0 left-0"
              style={{ width: `${getLessonShare(phase) * PERCENT}%` }}
            />
          </MeterPart>
        ))}
      </MeterParts>

      {position && (
        <span className="flex w-full items-baseline justify-between gap-3 text-xs">
          <span className="min-w-0 truncate">
            <span className="font-medium">{position.name}</span>
            {position.day && <span className="text-muted-foreground">{` · ${position.day}`}</span>}
          </span>
          <span className="text-muted-foreground flex shrink-0 items-center gap-0.5 font-mono tabular-nums">
            <span aria-hidden="true">
              {t("{number, number} of {total, number}", {
                number: position.number,
                total: position.total,
              })}
            </span>
            <span className="sr-only">{position.place}</span>
            {onOpen && <ChevronRightIcon aria-hidden="true" className="size-3.5" />}
          </span>
        </span>
      )}

      {!position && onOpen && (
        <span className="text-muted-foreground flex w-full items-center justify-between gap-3 text-xs">
          <span className="min-w-0 truncate">
            {t("{done, number} of {total, plural, one {# phase} other {# phases}} done", {
              done: phases.filter((phase) => phase.state === "done").length,
              total: phases.length,
            })}
          </span>
          <ChevronRightIcon aria-hidden="true" className="size-3.5 shrink-0" />
        </span>
      )}
    </>
  );

  if (!onOpen) {
    return (
      <div className={cn("flex flex-col gap-2", className)} data-slot="plan-roadmap">
        {content}
      </div>
    );
  }

  return (
    <button
      aria-haspopup="dialog"
      className={cn(
        "focus-visible:ring-ring/50 hover:bg-muted/70 -mx-2.5 flex min-h-11 flex-col gap-2 rounded-[0.625rem] px-2.5 py-1.5 text-left transition-colors outline-none focus-visible:ring-[3px]",
        className,
      )}
      data-slot="plan-roadmap"
      onClick={onOpen}
      type="button"
    >
      {content}
    </button>
  );
}

const PHASE_MARK = {
  current: "next",
  done: "done",
  leftOut: "todo",
  unfinished: "todo",
  upcoming: "todo",
} as const;

function RoadmapRevealList() {
  const t = useExtracted();
  const phaseName = usePhaseName();
  const { plan } = usePlanScreen();
  const { phases } = useRoadmapPhases();

  return (
    <div className="flex flex-col gap-2 sm:hidden" data-slot="plan-roadmap">
      <RoadmapCompact onOpen={null} />

      <ol className="flex flex-col [&>li+li]:border-t">
        {phases.map((phase) => (
          <li className="flex min-h-11 items-center gap-3 py-2 text-sm" key={phase.index}>
            <StatusMark
              label={phase.state === "current" ? t("You are here") : undefined}
              status={PHASE_MARK[phase.state]}
            />
            <span className="min-w-0 flex-1 font-medium text-pretty">
              {phaseName(phase, { mocksRequirePlus: plan.access.mocksRequirePlus })}
            </span>
            {phase.startDate && (
              <span className="text-muted-foreground shrink-0 font-mono text-xs tabular-nums">
                {phase.state === "current" ? (
                  t("Today")
                ) : (
                  <PlanDateText isoDate={phase.startDate} />
                )}
              </span>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}

function RoadmapReveal() {
  const t = useExtracted();
  const { currentIndex, phases, today } = useRoadmapPhases();
  const finish = useRoadmapFinish();
  const dated = phases.every((phase) => phase.startDate !== null);

  return (
    <div className="flex flex-col gap-1.5 max-sm:hidden" data-slot="plan-roadmap">
      <ol className="flex gap-[3px]">
        {phases.map((phase, position) => (
          <li
            className="@container/phase flex min-w-10 basis-0 flex-col gap-1.5"
            key={phase.index}
            style={{ flexGrow: getPhaseWeight(phase) }}
          >
            <span
              aria-current={phase.state === "current" ? "step" : undefined}
              className={cn(BAND_CLASS, BAND_STATE_CLASS[phase.state])}
            >
              <BandFace phase={phase} />
            </span>

            {dated && phase.startDate && (
              <>
                <PhaseAxis
                  flagOnPhone
                  isLast={position === phases.length - 1}
                  labelled={currentIndex !== -1 && position > currentIndex}
                  phase={phase}
                  todayShare={
                    position === currentIndex
                      ? getShareInPhase({ at: "start", date: today, phase })
                      : null
                  }
                />
                <span className="sr-only">
                  {t("From")} <PlanDateText isoDate={phase.startDate} />
                </span>
              </>
            )}
          </li>
        ))}
      </ol>

      {dated && finish && (
        <p className="sr-only">
          {t("Until")}{" "}
          <PlanDateText estimate={finish.estimate} isoDate={finish.isoDate} month={finish.month} />
        </p>
      )}
    </div>
  );
}

export function PlanRoadmap({
  className,
  density,
  links = null,
  onOpen = null,
}: {
  className?: string;
  density: "compact" | "full" | "reveal";
  links?: JourneyPathLinks | null;
  onOpen?: (() => void) | null;
}) {
  const { phases } = useRoadmapPhases();

  if (phases.length < 2) {
    return null;
  }

  if (density === "full" && links) {
    return <RoadmapFull className={className} links={links} />;
  }

  if (density === "reveal") {
    return (
      <>
        <RoadmapRevealList />
        <RoadmapReveal />
      </>
    );
  }

  return <RoadmapCompact className={className} onOpen={onOpen} />;
}
