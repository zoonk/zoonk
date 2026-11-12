"use client";

import { type LearnBuddy } from "../buddies/use-buddy-name";
import { FinishedChapterMoment } from "../mind-maps/finished-chapter-map";
import { MissionMoment } from "../missions/mission-moment";
import { type DayMomentFacts, pickDayMoment } from "./pick-day-moment";
import { ReachedMoment } from "./reached-moment";

export function DayMoment({
  buddy,
  ceremony,
  finishedChapter = null,
  missionMoment,
  reached,
}: DayMomentFacts & { buddy?: LearnBuddy | null }) {
  const pick = pickDayMoment({ ceremony, finishedChapter, missionMoment, reached });

  if (pick === "chapter") {
    return <FinishedChapterMoment chapter={finishedChapter} />;
  }

  if ((pick === "missions" || pick === "mission") && missionMoment) {
    return (
      <MissionMoment
        buddy={buddy}
        completed={missionMoment.completed}
        fullMeal={missionMoment.fullMeal}
        missions={missionMoment.missions}
      />
    );
  }

  if (pick === "belt" || pick === "glow") {
    return <ReachedMoment buddy={buddy} reached={reached} show={pick} />;
  }

  return null;
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
