"use client";

import { useCallback, useEffect, useRef } from "react";
import { type LessonClock, moveClock, settleClock, startClock } from "./_utils/lesson-clock";
import { type LessonPlayerAdapters } from "./lesson-player-types";
import { usePageLifecycle } from "./use-page-lifecycle";

/** The lesson's time counts only while the learner has the player in front of them. */
export function useLessonClock(adapters: LessonPlayerAdapters) {
  const clockRef = useRef<LessonClock | null>(null);
  const openRef = useRef(false);

  useEffect(() => {
    openRef.current = true;

    return () => {
      openRef.current = false;
    };
  }, []);

  const move = useCallback(
    (state: LessonClock["transition"]["state"]) => {
      const next = moveClock(clockRef.current, state);
      const send = adapters.updateLessonClock;

      if (!next || !send) {
        return;
      }

      clockRef.current = next;
      const sent = next.transition;

      void send(sent)
        .catch(() => false)
        .then((delivered) => {
          clockRef.current = settleClock({ clock: clockRef.current, delivered, sent });
        });
    },
    [adapters],
  );

  usePageLifecycle({
    onAway: () => move("paused"),
    onBack: () => move("running"),
    onLeave: () => move("paused"),
  });

  return useCallback(
    (run: { clockId: string | null; runId: string }) => {
      clockRef.current = startClock(run);

      if (!openRef.current || document.visibilityState === "hidden") {
        move("paused");
      }
    },
    [move],
  );
}
