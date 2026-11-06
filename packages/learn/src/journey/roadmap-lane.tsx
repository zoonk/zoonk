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
import { AXIS_CLASS, AXIS_TEXT_CLASS, AxisLabel, getPointSide } from "./roadmap-styles";
import { useRoadmapFinish, useRoadmapOverrun } from "./use-roadmap";

const PERCENT = 100;

const PHASE_END_SHARE = 0.9;

const FLAG_ROOM = "1rem";

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

function GoalDate() {
  const t = useExtracted();
  const { goal } = usePlanScreen();
  const finish = useRoadmapFinish();

  if (!finish) {
    return null;
  }

  const date = (
    <PlanDateText
      className="whitespace-normal"
      estimate={finish.estimate}
      isoDate={finish.isoDate}
      month={finish.month}
    />
  );

  if (goal.kind !== "exam") {
    return date;
  }

  return (
    <>
      <span className="@max-[8rem]/phase:hidden">
        {t.rich("<date></date> · exam", { date: () => date })}
      </span>
      <span className="hidden @max-[8rem]/phase:inline">{date}</span>
    </>
  );
}

function EndLabel({ after, phase }: { after: boolean; phase: PlanPhaseView }) {
  const finish = useRoadmapFinish();
  const overrun = useRoadmapOverrun();

  if (overrun && phase.endDate) {
    return (
      <AxisLabel after={after} share={1}>
        <PlanDateText className={AXIS_TEXT_CLASS} isoDate={phase.endDate} />
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

export function PhaseAxis({
  isLast,
  labelled,
  phase,
  todayShare,
}: {
  isLast: boolean;
  labelled: boolean;
  phase: PlanPhaseView;
  todayShare: number | null;
}) {
  const t = useExtracted();
  const overrun = useRoadmapOverrun();
  const goalShare = overrun?.phaseIndex === phase.index ? overrun.share : null;
  const goalSide = goalShare === null ? null : getPointSide(goalShare);

  const todayLabelled = todayShare !== null && goalShare === null;
  const startLabelled = labelled && phase.startDate !== null && goalSide !== "left";
  const finishLabelled = isLast && goalSide !== "right";

  return (
    <span aria-hidden="true" className={AXIS_CLASS}>
      {todayLabelled && (
        <AxisLabel share={todayShare}>
          <span className={cn(AXIS_TEXT_CLASS, "text-foreground")}>{t("Today")}</span>
        </AxisLabel>
      )}
      {startLabelled && phase.startDate && (
        <AxisLabel className={cn(isLast && "@max-[10rem]/phase:hidden")} share={0}>
          <PlanDateText
            className={AXIS_TEXT_CLASS}
            isoDate={phase.startDate}
            month={phase.kind === "learn"}
          />
        </AxisLabel>
      )}
      {goalShare !== null && (
        <AxisLabel after={startLabelled} share={goalShare}>
          <span className={cn(AXIS_TEXT_CLASS, "text-foreground")}>
            <GoalDate />
          </span>
        </AxisLabel>
      )}
      {finishLabelled && (
        <EndLabel after={todayLabelled || startLabelled || goalShare !== null} phase={phase} />
      )}
    </span>
  );
}
