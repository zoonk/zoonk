"use client";

import { MissionsCard } from "../missions/missions-card";
import { useTodayScreen } from "./today-context";

export function TodayMissions({ className }: { className?: string }) {
  const { actions, buddy, missions } = useTodayScreen();

  return (
    <MissionsCard
      buddy={buddy}
      className={className}
      collapseWhenDone
      foldRows
      links={actions.missionLinks}
      today={missions}
    />
  );
}
