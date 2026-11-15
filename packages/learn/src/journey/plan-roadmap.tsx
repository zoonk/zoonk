"use client";

import { MeterPart, MeterParts } from "@zoonk/ui/components/meter";
import { RowChevron } from "@zoonk/ui/components/row-chevron";
import { cn } from "@zoonk/ui/lib/utils";
import { useExtracted } from "next-intl";
import { StatusMark } from "../_components/status-mark";
import { TITLE_ROW_CLASS, TRUNCATED_TITLE_CLASS } from "../_components/title-row";
import { getPhaseWeight, getShareInPhase } from "../plan/phase-weight";
import { usePlanScreen } from "../plan/plan-context";
import { PlanDateText } from "../plan/plan-date-text";
import { usePhaseName } from "../plan/use-phase-name";
import { type JourneyPathLinks } from "./journey-links";
import { PathRowBody } from "./journey-phase-events";
import { PhaseWhen } from "./phase-when";
import { BandFace } from "./roadmap-band";
import { RoadmapFull } from "./roadmap-full";
import { PhaseAxis } from "./roadmap-lane";
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

      {lined && position && (
        <span
          className={cn(TITLE_ROW_CLASS, "w-full items-baseline text-xs")}
          data-slot="plan-roadmap-line"
        >
          {/* Too narrow for one line (large text), the place, the phase's name and its end each take a line of their own. */}
          <span className="stacked:flex-col flex min-w-0 flex-wrap items-baseline">
            <span className="font-medium">{position.place}</span>
            {position.name && (
              <span
                className={cn(
                  TRUNCATED_TITLE_CLASS,
                  "text-muted-foreground stacked:basis-auto max-w-max min-w-0 grow basis-24 text-pretty",
                )}
              >
                <span className="stacked:hidden whitespace-pre">{" · "}</span>
                {position.name}
              </span>
            )}
          </span>
          <span
            className="text-muted-foreground ms-auto flex items-center gap-3"
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
        className={cn(BAND_ROWS_CLASS, "grid-rows-[repeat(2,auto)] gap-y-1.5")}
        style={getBandColumnsStyle(phases.map((phase) => getPhaseWeight(phase)))}
      >
        {phases.map((phase, position) => {
          const isCurrent = position === currentIndex;

          return (
            <li className={BAND_COLUMN_CLASS} key={phase.index}>
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
                    todayShare={
                      isCurrent ? getShareInPhase({ at: "start", date: today, phase }) : null
                    }
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
