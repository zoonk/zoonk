"use client";

import { useEffect, useRef } from "react";
import { useLearnAnalytics } from "../learn-context";
import { type StudyMomentView, type StudySession } from "./session-types";

type Mission = StudySession["missions"][number];

/**
 * Each mission as analytics names it: the first three keep the names their events always had, so
 * a mission's history reads as one line; the rest are named as core names them.
 */
const MISSION_EVENT_NAMES = {
  askBuddy: "askBuddy",
  call: "call",
  challenge: "challenge",
  essay: "essay",
  finishChapter: "finishChapter",
  fixMistake: "fix",
  mock: "mock",
  pattern: "pattern",
  practice: "practice",
  pronunciation: "pronunciation",
  review: "review",
  somethingNew: "new",
  weakSpot: "weakSpot",
  weeklyChallenge: "weeklyChallenge",
} as const satisfies Record<Mission["kind"], string>;

function isDone(mission: Mission | undefined): boolean {
  return mission !== undefined && mission.status !== "todo";
}

/**
 * Sends the missions a block finished, once per moment. The block's own completion is an outcome
 * the server sends. Shared properties come from the host's registration.
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
