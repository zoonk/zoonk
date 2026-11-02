"use client";

import { type MissionView } from "../missions/mission-links";
import { MissionsCard } from "../missions/missions-card";
import { opensStep } from "./today-block-row";
import { useTodayScreen } from "./today-context";

function onlyOpensBlocks(missions: readonly MissionView[]): boolean {
  return missions.every(
    (mission) =>
      mission.status === "done" ||
      (mission.opens?.kind === "block" && !mission.waitReason && mission.total <= 1),
  );
}

export function TodayMissions({ className }: { className?: string }) {
  const { actions, brainPower, buddy, missions, today } = useTodayScreen();

  if (!missions || missions.missions.length === 0) {
    return null;
  }

  return (
    <MissionsCard
      blockOf={(mission) => today.session.blocks.find((block) => opensStep(mission.opens, block))}
      brainPower={brainPower}
      buddy={buddy}
      className={className}
      collapseWhenDone
      links={actions.missionLinks}
      rowsInQueue={onlyOpensBlocks(missions.missions)}
      today={missions}
    />
  );
}
