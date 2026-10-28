"use client";

import { useEffect, useRef } from "react";
import { useLearnAnalytics } from "../learn-context";
import { type StudyMomentView } from "./session-types";

/** The first three keep the event names they always had, so a mission's history reads as one line. */
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
} as const satisfies Record<StudyMomentView["completedMissions"][number], string>;

export function useMomentEvents({ moment }: { moment: StudyMomentView }) {
  const analytics = useLearnAnalytics();
  const sent = useRef<string | null>(null);

  useEffect(() => {
    if (sent.current === moment.blockId) {
      return;
    }

    sent.current = moment.blockId;

    for (const kind of moment.completedMissions) {
      analytics.track({
        name: "Mission Completed",
        properties: { full_meal: moment.fullMeal.paid, mission: MISSION_EVENT_NAMES[kind] },
      });
    }
  }, [analytics, moment]);
}
