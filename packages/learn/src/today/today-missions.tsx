"use client";

import { MissionsCard } from "../missions/missions-card";
import { useTodayScreen } from "./today-context";

/**
 * Today's missions as one card atop the aside (right after the day's action on a phone, their one
 * place there): the buddy offers them with their reward, each opens where it's done and says what
 * it still asks, and the card folds to one line once they're all done. The day's queue marks the
 * block each one opens. Left out until today's session exists, and on a day that offers none.
 */
export function TodayMissions({ className }: { className?: string }) {
  const { actions, brainPower, buddy, missions } = useTodayScreen();

  if (!missions || missions.missions.length === 0) {
    return null;
  }

  return (
    <MissionsCard
      brainPower={brainPower}
      buddy={buddy}
      className={className}
      collapseWhenDone
      links={actions.missionLinks}
      today={missions}
    />
  );
}
