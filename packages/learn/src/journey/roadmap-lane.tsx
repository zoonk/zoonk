"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { Trickster } from "@zoonk/ui/components/trickster";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindDot } from "../_components/kind-tile";
import { getShareInPhase } from "../plan/phase-weight";
import { usePlanScreen } from "../plan/plan-context";
import { PlanDateText } from "../plan/plan-date-text";
import { AXIS_LABEL_CLASS } from "./roadmap-styles";
import { useRoadmapFinish, useRoadmapOverrun } from "./use-roadmap";

const PERCENT = 100;

/** A challenge this close to its phase's end sits inside the band's end instead of across it. */
const PHASE_END_SHARE = 0.9;

/** Today's label reads leftward from its line past the middle of its band, so it stays inside. */
const MIDDLE_SHARE = 0.5;

/** A mark on a phase's lane, centred on its day. */
function LaneMark({
  children,
  className,
  share,
}: {
  children: React.ReactNode;
  className?: string;
  share: number;
}) {
  return (
    <span
      className={cn("absolute top-1/2 flex -translate-x-1/2 -translate-y-1/2", className)}
      style={{ left: `${share * PERCENT}%` }}
    >
      {children}
    </span>
  );
}

/**
 * Under a band, what happens in its phase: its next mock exam as a dot on its day, the
 * Trickster's challenge at its end, and the goal's flag at the end of the last one, or on its day
 * inside the phase it falls in when the plan runs past it. Decorative: each band's details and
 * "Next on your path" say them in words.
 */
export function PhaseLane({ isLast, phase }: { isLast: boolean; phase: PlanPhaseView }) {
  const finish = useRoadmapFinish();
  const overrun = useRoadmapOverrun();
  const { checkpoint, mocks } = phase;

  const mockShare =
    mocks.nextDate && getShareInPhase({ at: "middle", date: mocks.nextDate, phase });

  const challengeShare =
    checkpoint?.date && getShareInPhase({ at: "end", date: checkpoint.date, phase });

  const flag = isLast && finish !== null && !overrun;
  const overrunShare = overrun?.phaseIndex === phase.index ? overrun.share : null;

  return (
    <span aria-hidden="true" className="relative mt-1 block h-4">
      {typeof mockShare === "number" && (
        <LaneMark share={mockShare}>
          <KindDot className="size-1.5" kind="mock" />
        </LaneMark>
      )}

      {typeof challengeShare === "number" && (
        <LaneMark
          className={cn(challengeShare > PHASE_END_SHARE && "-translate-x-full", flag && "-ml-4")}
          share={challengeShare}
        >
          <Trickster className="size-3.5" />
        </LaneMark>
      )}

      {flag && <FlagIcon className="absolute top-0 right-0 size-3.5" />}

      {overrunShare !== null && (
        <LaneMark share={overrunShare}>
          <FlagIcon className="size-3.5" />
        </LaneMark>
      )}
    </span>
  );
}

/** Which way a day's label reads from its line: rightward in a band's first half, else leftward. */
function getLabelSide(share: number): "left" | "right" {
  return share < MIDDLE_SHARE ? "left" : "right";
}

/** A label's place from its line, on the side it reads toward, so it stays inside its band. */
function getLabelStyle(share: number): React.CSSProperties {
  return getLabelSide(share) === "left"
    ? { left: `${share * PERCENT}%` }
    : { right: `${(1 - share) * PERCENT}%` };
}

/** "Today" under the current band, where today falls in it: left of the line, or right near the end. */
function TodayLabel({ share }: { share: number }) {
  const t = useExtracted();
  const style = getLabelStyle(share);

  return (
    <span className={cn(AXIS_LABEL_CLASS, "text-foreground")} style={style}>
      {t("Today")}
    </span>
  );
}

/** The goal's date in words: its day (or month), and that it's the exam's. */
function FinishDate() {
  const t = useExtracted();
  const { goal } = usePlanScreen();
  const finish = useRoadmapFinish();

  if (!finish) {
    return null;
  }

  const date = (
    <PlanDateText estimate={finish.estimate} isoDate={finish.isoDate} month={finish.month} />
  );

  return goal.kind === "exam" ? t.rich("<date></date> · exam", { date: () => date }) : date;
}

/**
 * The road's end, at the right of the last band: the goal's date. With `flagOnPhone`, an exam's
 * end is its flag under `sm` instead: on a phone its date would run into the day before it, since
 * an exam's last phase is short. A plan that runs past the goal's date ends on its own last day,
 * which then says where the road really ends (the date has its label on its day).
 */
function FinishLabel({
  flagOnPhone = false,
  phase,
}: {
  flagOnPhone?: boolean;
  phase: PlanPhaseView;
}) {
  const { goal } = usePlanScreen();
  const finish = useRoadmapFinish();
  const overrun = useRoadmapOverrun();

  if (overrun && phase.endDate) {
    return <PlanDateText className={cn(AXIS_LABEL_CLASS, "right-0")} isoDate={phase.endDate} />;
  }

  if (!finish) {
    return null;
  }

  const exam = goal.kind === "exam";
  const labelClass = cn(AXIS_LABEL_CLASS, "text-foreground right-0");

  // In a short last band, "· exam" would run the date into the label before it (a long
  // Portuguese date did at 1180px): the flag over it and the legend already say it.
  const labels = (
    <>
      <span className={cn(labelClass, exam && "@max-[8rem]/phase:hidden")}>
        <FinishDate />
      </span>
      {exam && (
        <PlanDateText
          className={cn(labelClass, "hidden @max-[8rem]/phase:inline")}
          estimate={finish.estimate}
          isoDate={finish.isoDate}
          month={finish.month}
        />
      )}
    </>
  );

  if (!exam || !flagOnPhone) {
    return labels;
  }

  return (
    <>
      <FlagIcon className="absolute top-0.5 right-0 size-3.5 sm:hidden" />
      <span className="max-sm:hidden">{labels}</span>
    </>
  );
}

/**
 * The goal's date under its flag, inside the band it falls in, when the plan runs past it: from
 * its day to the right in the first half of the band, ending at its day past it.
 */
function OverrunLabel({ share }: { share: number }) {
  return (
    <span className={cn(AXIS_LABEL_CLASS, "text-foreground")} style={getLabelStyle(share)}>
      <FinishDate />
    </span>
  );
}

/**
 * A phase's stretch of the road's one line of days, under its band: today in the current one
 * (`todayShare`, where today falls in it), the first day of one ahead (`labelled`), the road's end
 * in the last. Each phase is a `@container/phase`, so a label that wouldn't fit beside its
 * neighbors is left out; a band's details still say it. Decorative: screen readers hear the dates
 * elsewhere. `flagOnPhone`: see `FinishLabel`, for a road drawn on a phone (the plan's reveal).
 */
export function PhaseAxis({
  flagOnPhone = false,
  isLast,
  labelled,
  phase,
  todayShare,
}: {
  flagOnPhone?: boolean;
  isLast: boolean;
  labelled: boolean;
  phase: PlanPhaseView;
  todayShare: number | null;
}) {
  const overrun = useRoadmapOverrun();
  const overrunShare = overrun?.phaseIndex === phase.index ? overrun.share : null;
  const overrunSide = overrunShare === null ? null : getLabelSide(overrunShare);

  // In the band the goal's date falls in, its label is the one there's room for (it's why the plan
  // no longer fits): today keeps its line, and the band's first or last day gives way on the side
  // the date reads toward. The band's details still say them.
  const todayLabelled = todayShare !== null && overrunShare === null;
  const startLabelled = labelled && phase.startDate !== null && overrunSide !== "left";
  const finishLabelled = isLast && overrunSide !== "right";

  return (
    <span aria-hidden="true" className="relative block h-4">
      {todayLabelled && <TodayLabel share={todayShare} />}
      {overrunShare !== null && <OverrunLabel share={overrunShare} />}
      {startLabelled && phase.startDate && (
        <PlanDateText
          className={cn(
            AXIS_LABEL_CLASS,
            "left-0",
            isLast ? "@max-[10rem]/phase:hidden" : "@max-[4.5rem]/phase:hidden",
          )}
          isoDate={phase.startDate}
          month={phase.kind === "learn"}
        />
      )}
      {finishLabelled && <FinishLabel flagOnPhone={flagOnPhone} phase={phase} />}
    </span>
  );
}
