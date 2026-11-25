"use client";

import { type PlanPhaseView } from "@zoonk/core/plans/view-contract";
import { cn } from "@zoonk/ui/lib/utils";
import { FlagIcon } from "lucide-react";
import { useExtracted } from "next-intl";
import { KindDot } from "../_components/kind-tile";
import { getShareInPhase } from "../plan/phase-weight";
import { PlanDateText } from "../plan/plan-date-text";
import { PhaseCheckpointMark } from "./journey-phase-events";
import { PhaseWhen } from "./phase-when";
import {
  AXIS_CLASS,
  AXIS_TEXT_CLASS,
  AxisLabel,
  BAND_SIZER_CLASS,
  getPointSide,
} from "./roadmap-styles";
import { useAxisFinish, useRoadmapFinish, useRoadmapOverrun } from "./use-roadmap";

const PERCENT = 100;

const PHASE_END_SHARE = 0.9;

const FLAG_ROOM = "1.25rem";

function LaneMark({
  beforeFlag = false,
  children,
  end = false,
  share,
}: {
  beforeFlag?: boolean;
  children: React.ReactNode;
  end?: boolean;
  share: number;
}) {
  const anchor = end ? "-100%" : "-50%";

  const x = beforeFlag
    ? `min(${anchor}, ${(1 - share) * PERCENT}cqw - ${FLAG_ROOM} - 100%)`
    : anchor;

  return (
    <span
      className="absolute top-1/2 flex"
      style={{ left: `${share * PERCENT}%`, translate: `${x} -50%` }}
    >
      {children}
    </span>
  );
}

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
    <span aria-hidden="true" className="@container relative mt-2 block h-4">
      {typeof mockShare === "number" && (
        <LaneMark beforeFlag={flag} share={mockShare}>
          <KindDot className="size-1.5" kind="mock" />
        </LaneMark>
      )}

      {typeof challengeShare === "number" && (
        <LaneMark beforeFlag={flag} end={challengeShare > PHASE_END_SHARE} share={challengeShare}>
          <PhaseCheckpointMark />
        </LaneMark>
      )}

      {flag && <FlagIcon className="absolute top-1/2 right-0 size-3.5 -translate-y-1/2" />}

      {overrunShare !== null && (
        <LaneMark share={overrunShare}>
          <FlagIcon className="size-3.5" />
        </LaneMark>
      )}
    </span>
  );
}

/** The legend names it ("Exam date", "End date"), so the date stands alone on the axis. */
function GoalDate() {
  const finish = useRoadmapFinish();

  if (!finish) {
    return null;
  }

  return <PlanDateText estimate={finish.estimate} isoDate={finish.isoDate} month={finish.month} />;
}

/** In the last phase's band, so that phase is never narrower than the date under it. */
export function EndDateSizer() {
  const finish = useRoadmapFinish();

  if (!finish) {
    return null;
  }

  return (
    <span aria-hidden="true" className={BAND_SIZER_CLASS}>
      <PlanDateText
        className="text-2xs"
        estimate={finish.estimate}
        isoDate={finish.isoDate}
        month={finish.month}
      />
    </span>
  );
}

function EndLabel({ after, phase }: { after: boolean; phase: PlanPhaseView }) {
  const finish = useAxisFinish();
  const overrun = useRoadmapOverrun();

  if (overrun) {
    return (
      <AxisLabel after={after} share={1}>
        <PhaseWhen className={AXIS_TEXT_CLASS} phase={phase} />
      </AxisLabel>
    );
  }

  if (!finish) {
    return null;
  }

  return (
    <AxisLabel after={after} share={1}>
      <span className={cn(AXIS_TEXT_CLASS, "text-foreground")}>
        <GoalDate />
      </span>
    </AxisLabel>
  );
}

/** The band's corner radius (`rounded-md`), so the tick never lands on its curve. */
const BAND_CORNER = "0.375rem";

/**
 * "Today" over the current band, and a tick from under the word through the band's full height, so
 * the word points at a day on the bar. The tick spans the column's first two rows (its containing
 * block is their grid area), and stays off the band's rounded corners.
 */
export function TodayTick({ share }: { share: number | null }) {
  const t = useExtracted();

  if (share === null) {
    return <span aria-hidden="true" />;
  }

  return (
    <>
      <span aria-hidden="true" className="flex items-end">
        <AxisLabel share={share}>
          <span className="text-foreground text-2xs pb-1 leading-4">{t("Today")}</span>
        </AxisLabel>
      </span>
      <span
        aria-hidden="true"
        className="bg-foreground pointer-events-none absolute top-4 bottom-0 z-10 col-start-1 row-start-1 row-end-3 w-[1.5px] -translate-x-1/2"
        data-slot="today-tick"
        style={{ left: `clamp(${BAND_CORNER}, ${share * PERCENT}%, 100% - ${BAND_CORNER})` }}
      />
    </>
  );
}

export function PhaseAxis({
  isLast,
  labelled,
  phase,
}: {
  isLast: boolean;
  labelled: boolean;
  phase: PlanPhaseView;
}) {
  const overrun = useRoadmapOverrun();
  const axisFinish = useAxisFinish();
  const goalShare = overrun?.phaseIndex === phase.index && axisFinish ? overrun.share : null;
  const goalSide = goalShare === null ? null : getPointSide(goalShare);

  const endLabelled = labelled && goalSide !== "right";
  const finishLabelled = isLast && goalSide !== "right";

  return (
    <span aria-hidden="true" className={AXIS_CLASS}>
      {goalShare !== null && (
        <AxisLabel share={goalShare}>
          <span className={cn(AXIS_TEXT_CLASS, "text-foreground")}>
            <GoalDate />
          </span>
        </AxisLabel>
      )}
      {endLabelled && (
        <AxisLabel after={goalShare !== null} share={1}>
          <PhaseWhen className={AXIS_TEXT_CLASS} phase={phase} />
        </AxisLabel>
      )}
      {finishLabelled && <EndLabel after={goalShare !== null} phase={phase} />}
    </span>
  );
}
