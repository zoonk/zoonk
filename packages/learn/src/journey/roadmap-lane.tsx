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

const PHASE_END_SHARE = 0.9;

const MIDDLE_SHARE = 0.5;

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

function getLabelSide(share: number): "left" | "right" {
  return share < MIDDLE_SHARE ? "left" : "right";
}

function getLabelStyle(share: number): React.CSSProperties {
  return getLabelSide(share) === "left"
    ? { left: `${share * PERCENT}%` }
    : { right: `${(1 - share) * PERCENT}%` };
}

function TodayLabel({ share }: { share: number }) {
  const t = useExtracted();
  const style = getLabelStyle(share);

  return (
    <span className={cn(AXIS_LABEL_CLASS, "text-foreground")} style={style}>
      {t("Today")}
    </span>
  );
}

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

function OverrunLabel({ share }: { share: number }) {
  return (
    <span className={cn(AXIS_LABEL_CLASS, "text-foreground")} style={getLabelStyle(share)}>
      <FinishDate />
    </span>
  );
}

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
