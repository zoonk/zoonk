"use client";

import { useEffect, useMemo, useRef } from "react";
import { type LessonClock, moveClock, settleClock, startClock } from "./_utils/lesson-clock";
import { type LessonPlayerAdapters } from "./lesson-player-types";
import { usePageLifecycle } from "./use-page-lifecycle";

/** The lesson's time counts only while the learner has the player in front of them. */
export function useLessonClock(adapters: LessonPlayerAdapters) {
  const clockRef = useRef<LessonClock | null>(null);
  const openRef = useRef(false);

  const actions = useMemo(() => {
    function runClock(run: { clockId: string | null; runId: string }) {
      clockRef.current = startClock(run);

      if (!openRef.current || document.visibilityState === "hidden") {
        move("paused");
      }
    }

    function move(state: LessonClock["transition"]["state"]) {
      const next = moveClock(clockRef.current, state);
      const send = adapters.updateLessonClock;

      if (!next || !send) {
        return;
      }

      clockRef.current = next;
      const sent = next.transition;

      void send(sent)
        .catch(() => null)
        .then(async (outcome) => {
          // The server dropped this clock, so running counts only once Start gives a new one.
          const restarts =
            outcome?.status === "ignored" &&
            sent.state === "running" &&
            clockRef.current?.transition === sent;

          const run = restarts
            ? await adapters.startLesson({ runId: sent.runId }).catch(() => null)
            : null;

          if (run?.reason === "started" && clockRef.current?.transition.clockId === sent.clockId) {
            runClock(run);
            return;
          }

          clockRef.current = settleClock({
            clock: clockRef.current,
            delivered: outcome !== null && !restarts,
            sent,
          });
        });
    }

    return { move, runClock };
  }, [adapters]);

  useEffect(() => {
    openRef.current = true;

    if (document.visibilityState === "visible") {
      actions.move("running");
    }

    return () => {
      openRef.current = false;
    };
  }, [actions]);

  usePageLifecycle({
    onAway: () => actions.move("paused"),
    onBack: () => actions.move("running"),
    onLeave: () => actions.move("paused"),
  });

  return actions.runClock;
}
