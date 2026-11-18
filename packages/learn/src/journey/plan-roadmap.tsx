"use client";

import { MeterPart, MeterParts } from "@zoonk/ui/components/meter";
import { RowChevron } from "@zoonk/ui/components/row-chevron";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { StatusMark } from "../_components/status-mark";
import { FactSegments } from "../_components/task-meta";
import { getPhaseWeight, getShareInPhase } from "../plan/phase-weight";
import { usePlanScreen } from "../plan/plan-context";
import { PlanDateText } from "../plan/plan-date-text";
import { usePhaseName } from "../plan/use-phase-name";
import { CurrentPhaseMark } from "./current-phase-mark";
import { type JourneyPathLinks } from "./journey-links";
import { PathRowBody } from "./journey-phase-events";
import { PhaseWhen } from "./phase-when";
import { BandFace } from "./roadmap-band";
import { RoadmapFull } from "./roadmap-full";
import { PhaseAxis, TodayTick } from "./roadmap-lane";
import {
  BAND_CLASS,
  BAND_COLUMN_CLASS,
  BAND_ROWS_CLASS,
  BAND_STATE_CLASS,
  getBandColumnsStyle,
} from "./roadmap-styles";
import {
  getLessonShare,
  useAxisDatedPhases,
  useRoadmapFinish,
  useRoadmapPhases,
  useRoadmapPosition,
} from "./use-roadmap";

const PERCENT = 100;

function RoadmapCompact({
  className,
  lined = true,
  onOpen,
}: {
  className?: string;
  lined?: boolean;
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
              phase.state === "current" && BAND_STATE_CLASS.current,
            )}
            key={phase.index}
            weight={getPhaseWeight(phase)}
          >
            <span
              className={cn(
                "absolute inset-y-0 left-0",
                phase.state === "current" ? "bg-success/30" : "bg-success",
              )}
              style={{ width: `${getLessonShare(phase) * PERCENT}%` }}
            />
            {phase.state === "current" && (
              <CurrentPhaseMark className="absolute top-1/2 left-1/2 size-1 -translate-1/2 ring-1" />
            )}
          </MeterPart>
        ))}
      </MeterParts>

      {lined && position && (
        <span
          className="flex w-full items-center justify-between gap-2 text-xs"
          data-slot="plan-roadmap-line"
        >
          <span className="text-muted-foreground min-w-0 text-balance">
            <FactSegments
              facts={[position.name]}
              lead={<span className="text-foreground font-medium">{position.place}</span>}
            />
          </span>
          <span
            className="text-muted-foreground flex shrink-0 items-center gap-2"
            data-slot="plan-roadmap-when"
          >
            <PhaseWhen phase={position.phase} />
            {onOpen && <RowChevron />}
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
          <RowChevron />
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
        "focus-visible:ring-ring/50 hover:bg-muted/70 -mx-2.5 flex min-h-11 flex-col gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors outline-none focus-visible:ring-[3px]",
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
      {/* The list under it marks the learner's phase and dates each phase's end, so the meter has no line. */}
      <RoadmapCompact lined={false} onOpen={null} />

      <ol className="flex flex-col [&>li+li]:border-t" data-slot="journey-path-list">
        {phases.map((phase) => (
          <li
            className="flex min-h-11 items-center gap-3 py-2 text-sm"
            data-slot="path-row"
            key={phase.index}
          >
            <StatusMark
              label={phase.state === "current" ? t("You are here") : undefined}
              status={PHASE_MARK[phase.state]}
            />
            <PathRowBody
              value={<PhaseWhen className="text-muted-foreground text-xs" phase={phase} />}
            >
              <span className="font-medium text-pretty">
                {phaseName(phase, { mocksRequirePlus: plan.access.mocksRequirePlus })}
              </span>
            </PathRowBody>
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
  const axisDated = useAxisDatedPhases();
  const dated = phases.every((phase) => phase.startDate !== null);

  return (
    <div className="flex flex-col gap-1.5 max-sm:hidden" data-slot="plan-roadmap">
      <ol
        className={cn(BAND_ROWS_CLASS, "grid-rows-[repeat(3,auto)] gap-y-1.5")}
        style={getBandColumnsStyle(phases.map((phase) => getPhaseWeight(phase)))}
      >
        {phases.map((phase, position) => {
          const isCurrent = position === currentIndex;

          return (
            <li className={BAND_COLUMN_CLASS} key={phase.index}>
              <TodayTick
                share={
                  dated && isCurrent ? getShareInPhase({ at: "start", date: today, phase }) : null
                }
              />
              <span
                aria-current={phase.state === "current" ? "step" : undefined}
                className={cn(BAND_CLASS, BAND_STATE_CLASS[phase.state])}
              >
                <BandFace isLast={position === phases.length - 1} phase={phase} />
              </span>

              {dated && phase.startDate && (
                <>
                  <PhaseAxis
                    isLast={position === phases.length - 1}
                    labelled={axisDated.has(phase.index)}
                    phase={phase}
                  />
                  <span className="sr-only">
                    <PhaseWhen phase={phase} />
                  </span>
                </>
              )}
            </li>
          );
        })}
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
