"use client";

import { FunDestination } from "./fun-destination";
import { FunFlightPlan } from "./fun-flight-plan";
import { FunMissions } from "./fun-missions";
import { useTodayScreen } from "./today-context";
import { TodayExamAccess } from "./today-exam-access";
import { TodayExamMoment } from "./today-exam-moment";
import { TodayFreshStart } from "./today-fresh-start";
import { TodayInsight } from "./today-insight";
import { TodayShortPlan } from "./today-short-plan";
import { TodaySuggestedGoal } from "./today-suggested-goal";
import { TodayWeek } from "./today-week";
import { TodayWeeklyChallenge } from "./today-weekly-challenge";

/**
 * Fun Today: the destination planet with the countdown, the flight plan with one Take off, then
 * the missions from the second study day. The week and any insight sit below, as in Focus.
 */
export function FunToday() {
  const { today } = useTodayScreen();

  return (
    <div className="flex flex-col gap-7" data-slot="fun-today">
      <FunDestination />
      <TodayShortPlan />
      <TodayFreshStart />
      <TodayExamMoment />
      <TodayExamAccess />
      <FunFlightPlan />
      {today.reveal.missions && <FunMissions />}

      <div className="fun-glass flex flex-col gap-3 rounded-3xl p-4">
        <TodayWeek />
        <TodayWeeklyChallenge />
      </div>

      <TodayInsight />
      <TodaySuggestedGoal />
    </div>
  );
}
