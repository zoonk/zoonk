"use client";

import { MeterPart, MeterParts } from "@zoonk/ui/components/meter";
import { RowChevron } from "@zoonk/ui/components/row-chevron";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { getPhaseWeight } from "../plan/phase-weight";
import { PlanDateText } from "../plan/plan-date-text";
import { type JourneyPathLinks } from "./journey-links";
import { PhaseWhen } from "./phase-when";
import { RoadmapFull } from "./roadmap-full";
import { BAND_STATE_CLASS } from "./roadmap-styles";
import {
  getLessonShare,
  useFinishLabel,
  useRoadmapFinish,
  useRoadmapPhases,
  useRoadmapPosition,
} from "./use-roadmap";

const PERCENT = 100;

/** Where the bar ends, as the full timeline's axis ends: the flag and the goal's date, or open. */
function CompactFinish() {
  const finish = useRoadmapFinish();
  const finishLabel = useFinishLabel();

  if (!finish) {
    return null;
  }

  return (
    <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs">
      <FlagIcon aria-hidden="true" className="size-3.5" />
      <span className="sr-only">{finishLabel}</span>
      <PlanDateText inWords {...finish} />
    </span>
  );
}

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
  // One phase has no place to say under the bar, so the way to its path ends the bar.
  const single = phases.length === 1;

  const content = (
    <>
      <span className="flex w-full items-center gap-2">
        <MeterParts as="span" className="min-w-0 flex-1">
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
            </MeterPart>
          ))}
        </MeterParts>
        <CompactFinish />
        {single && onOpen && <RowChevron />}
      </span>

      {position && (
        <span
          className="flex w-full items-center justify-between gap-2 text-xs"
          data-slot="plan-roadmap-line"
        >
          <span className="min-w-0 font-medium">{position.place}</span>
          <span
            className="text-muted-foreground flex shrink-0 items-center gap-2"
            data-slot="plan-roadmap-when"
          >
            <PhaseWhen labelled phase={position.phase} />
            {onOpen && <RowChevron />}
          </span>
        </span>
      )}

      {!position && !single && onOpen && (
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
        "focus-visible:ring-ring/50 hover:bg-muted/70 held-pressed:bg-muted -mx-2.5 flex min-h-11 flex-col gap-2 rounded-lg px-2.5 py-1.5 text-left transition-colors outline-none focus-visible:ring-[3px]",
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

export function PlanRoadmap({
  className,
  density,
  links = null,
  onOpen = null,
}: {
  className?: string;
  density: "compact" | "full";
  links?: JourneyPathLinks | null;
  onOpen?: (() => void) | null;
}) {
  const { phases } = useRoadmapPhases();

  if (phases.length === 0) {
    return null;
  }

  if (density === "full" && links) {
    return <RoadmapFull className={className} links={links} />;
  }

  return <RoadmapCompact className={className} onOpen={onOpen} />;
}
