"use client";

import { useEffect, useState } from "react";
import { deviceStorage } from "../_utils/device-storage";
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
  // Prototype only, for the founder's review (B2-017's second option): a slim card for one mission done.
  const [slimCard, setSlimCard] = useState(false);

  useEffect(() => {
    setSlimCard(deviceStorage.get("zoonk:b2-mission-card") === "1");
  }, []);

  if (pick === "chapter") {
    return <FinishedChapterMoment chapter={finishedChapter} />;
  }

  if ((pick === "missions" || (pick === null && slimCard)) && missionMoment) {
    return (
      <MissionMoment
        buddy={buddy}
        completed={missionMoment.completed}
        fullMeal={missionMoment.fullMeal}
        missions={missionMoment.missions}
      />
    );
  }

  return pick === "belt" ? <ReachedMoment reached={reached} /> : null;
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
