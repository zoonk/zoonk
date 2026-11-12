"use client";

import { MissionsCard } from "../missions/missions-card";
import { useTodayScreen } from "./today-context";

export function TodayMissions({ className }: { className?: string }) {
  const { actions, brainPower, buddy, missions } = useTodayScreen();

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
