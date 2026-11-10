"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { useEffect, useRef } from "react";
import { type LessonPlayerState } from "./lesson-player-state";

export function useFirstSceneClock({
  goalId,
  lessonId,
  state,
  track,
}: {
  goalId: string | null;
  lessonId: string;
  state: LessonPlayerState;
  track: TrackEvent;
}) {
  const shown = useRef(false);
  const answered = useRef(false);

  const hasAnswered =
    state.phase === "checking" ||
    (state.phase === "feedback" && state.actedOn.some((id) => state.results[id] !== undefined));

  const hasScene = state.queue[state.position] !== undefined;

  useEffect(() => {
    const show = () => {
      if (goalId && hasScene && !shown.current && document.visibilityState === "visible") {
        shown.current = true;

        track({
          name: "Onboarding Progressed",
          properties: {
            at: Date.now(),
            goal_id: goalId,
            lesson_id: lessonId,
            stage: "first_scene_visible",
          },
        });
      }
    };

    show();
    document.addEventListener("visibilitychange", show);
    return () => document.removeEventListener("visibilitychange", show);
  }, [goalId, hasScene, lessonId, track]);

  useEffect(() => {
    if (goalId && hasAnswered && !answered.current) {
      answered.current = true;

      track({
        name: "Onboarding Progressed",
        properties: { at: Date.now(), goal_id: goalId, lesson_id: lessonId, stage: "first_answer" },
      });
    }
  }, [goalId, hasAnswered, lessonId, track]);
}
