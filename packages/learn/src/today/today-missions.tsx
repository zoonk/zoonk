"use client";

import { type MissionView } from "../missions/mission-links";
import { MissionsCard } from "../missions/missions-card";
import { useTodayScreen } from "./today-context";

/**
 * Every mission still to do only opens one of the day's blocks, with nothing to wait for and no
 * count of its own ("0/2"): the queue already lists each one, marked violet.
 */
function onlyOpensBlocks(missions: readonly MissionView[]): boolean {
  return missions.every(
    (mission) =>
      mission.status === "done" ||
      (mission.opens?.kind === "block" && !mission.waitReason && mission.total <= 1),
  );
}

/**
 * Today's missions as one card atop the aside (right after the day's action on a phone, their one
 * place there): the buddy offers them with their reward, each opens where it's done and says what
 * it still asks, and the card folds to one line once they're all done. The day's queue marks the
 * block each one opens; where the card follows the queue, missions that only open its blocks
 * leave their rows to it (`rowsInQueue`). Left out until today's session exists, and on a day that
 * offers none.
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
      rowsInQueue={onlyOpensBlocks(missions.missions)}
      today={missions}
    />
  );
}
