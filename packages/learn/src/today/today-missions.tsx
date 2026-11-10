"use client";

import { type MissionView } from "../missions/mission-links";
import { MissionsCard } from "../missions/missions-card";
import { type DayStep } from "../session/session-types";
import { opensStep } from "./today-block-row";
import { useTodayScreen } from "./today-context";
import { getFoldedBlocks } from "./today-queue";

/** The card keeps its rows while a mission's block is folded out of the queue. */
function leavesRowsToQueue({
  folded,
  missions,
}: {
  folded: readonly DayStep[];
  missions: readonly MissionView[];
}): boolean {
  return missions.every(
    (mission) =>
      mission.status === "done" ||
      (mission.opens?.kind === "block" &&
        !mission.waitReason &&
        mission.total <= 1 &&
        !folded.some((block) => opensStep(mission.opens, block))),
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
      rowsInQueue={leavesRowsToQueue({
        folded: getFoldedBlocks(today.session),
        missions: missions.missions,
      })}
      today={missions}
    />
  );
}
