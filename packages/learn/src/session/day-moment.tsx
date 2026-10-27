"use client";

import { type MissionMomentView } from "@zoonk/core/sessions/completion-contract";
import { type Reached } from "@zoonk/core/sessions/reached";
import { type LearnBuddy } from "../buddies/use-buddy-name";
import { type CeremonyMilestone } from "../ceremonies/use-ceremony-copy";
import { MissionMoment, getAfterMissionsDelay } from "../missions/mission-moment";
import { ReachedMoment } from "./reached-moment";

/**
 * What a learner's work did to their day, the same on every result that earns Brain Power or
 * Energy (a block, a mock, a duel, a notebook practice, a drill, a round, a call, a test, a lesson
 * on its own): the day's missions it completed, with the bonus when it did the last, then the belt
 * level and the tenth of Energy it reached, on the beat after the missions' last one, each part
 * 24px from the next as every celebration spaces them. Nothing when it did none of that, not even
 * a gap. Its milestone's ceremony (`ceremony`) shows before the result; here it only keeps a new
 * belt's level from being said twice.
 */
export function DayMoment({
  buddy,
  ceremony,
  missionMoment,
  reached,
}: {
  /** The learner's buddy, where the screen knows it: it's glad about the missions with them. */
  buddy?: LearnBuddy | null;
  ceremony: Pick<CeremonyMilestone, "kind"> | null;
  /** The day's missions the work completed; null when it completed none. */
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

/**
 * A result's step told in `Steps` (a call's stars, a speaking band, a test's outcome) with what the
 * work did to the day under it: the step's own parts keep the 16px `Steps` gives them, and the day's
 * moment sits 24px under them, as on every task's end.
 */
export function StepWithDayMoment({
  children,
  dayMoment,
}: {
  children: React.ReactNode;
  /** What the work did to the day (`DayMoment`). */
  dayMoment: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">{children}</div>
      {dayMoment}
    </div>
  );
}
