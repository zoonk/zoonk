"use client";

import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { type Reached } from "@zoonk/core/sessions/reached";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type CeremonyMilestone } from "../ceremonies/use-ceremony-copy";
import { MissionMoment, getAfterMissionsDelay } from "../missions/mission-moment";
import { ReachedMoment } from "./reached-moment";

/** `ceremony` only keeps a new belt's level from being said twice: the ceremony itself shows before the result. */
export function DayMoment({
  buddy,
  ceremony,
  missionMoment,
  reached,
}: {
  buddy?: LearnBuddy | null;
  ceremony: Pick<CeremonyMilestone, "kind"> | null;
  missionMoment: MissionMomentView | null;
  reached: Reached;
}) {
  return (
    <div className="flex w-full flex-col gap-6 empty:hidden" data-slot="day-moment">
      {missionMoment && (
        <MissionMoment
          buddy={buddy}
          completed={missionMoment.completed}
          fullMeal={missionMoment.fullMeal}
          missions={missionMoment.missions}
        />
      )}
      <ReachedMoment
        buddy={buddy}
        ceremony={ceremony}
        delay={getAfterMissionsDelay(missionMoment)}
        reached={reached}
      />
    </div>
  );
}

export function StepWithDayMoment({
  children,
  dayMoment,
}: {
  children: React.ReactNode;
  dayMoment: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">{children}</div>
      {dayMoment}
    </div>
  );
}
