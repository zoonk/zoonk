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
          clockRef.current = settleClock({
            clock: clockRef.current,
            delivered: outcome !== null,
            sent,
          });

          if (
            outcome?.status !== "ignored" ||
            sent.state !== "running" ||
            clockRef.current?.transition !== sent
          ) {
            return;
          }

          const run = await adapters.startLesson({ runId: sent.runId }).catch(() => null);

          if (run?.reason === "started" && clockRef.current?.transition.clockId === sent.clockId) {
            runClock(run);
          }
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
