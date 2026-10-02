"use client";

import { useEffect, useRef } from "react";
import { useLearnAnalytics } from "../learn-context";
import { type StudyMomentView, type StudySession } from "./session-types";

type Mission = StudySession["missions"][number];

const MISSION_EVENT_NAMES = {
  fixMistake: "fix",
  review: "review",
  somethingNew: "new",
} as const satisfies Record<Mission["kind"], string>;

function isDone(mission: Mission | undefined): boolean {
  return mission !== undefined && mission.status !== "todo";
}

/**
 * Sends the missions a block finished, once per moment. The block's own completion is an outcome
 * the server sends. Shared properties such as `mode` come from the host's registration.
 */
export function useMomentEvents({
  missionsBefore,
  moment,
}: {
  missionsBefore: Mission[];
  moment: StudyMomentView;
}) {
  const analytics = useLearnAnalytics();
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (sent.current === moment.blockId) {
      return;
    }

    sent.current = moment.blockId;

    const finished = moment.missions.filter(
      (mission) =>
        isDone(mission) && !isDone(missionsBefore.find((before) => before.kind === mission.kind)),
    );

    for (const mission of finished) {
      analytics.track({
        name: "Mission Completed",
        properties: { full_meal: moment.fullMeal.paid, mission: MISSION_EVENT_NAMES[mission.kind] },
      });
    }
  }, [analytics, missionsBefore, moment]);
}
