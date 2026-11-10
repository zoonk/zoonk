"use client";

import { useEffect, useMemo, useRef } from "react";
import { type LessonClock, moveClock, settleClock, startClock } from "./_utils/lesson-clock";
import { type LessonPlayerAdapters } from "./lesson-player-types";
import { usePageLifecycle } from "./use-page-lifecycle";

/** The lesson's time counts only while the learner has the player in front of them. */
export function useLessonClock(adapters: LessonPlayerAdapters) {
  const clockRef = useRef<LessonClock | null>(null);
  const openRef = useRef(false);
  const sendingRef = useRef(new Set<Promise<void>>());

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

      const sending = send(sent)
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

      sendingRef.current.add(sending);
      void sending.finally(() => sendingRef.current.delete(sending));
    }

    /** Sends the latest change again under its sequence when it didn't get through. */
    function resend() {
      const state = clockRef.current?.transition.state;

      if (state) {
        move(state);
      }
    }

    /** Settles once no change is on its way, including one a restart sends on its new clock. */
    async function flush() {
      resend();

      while (sendingRef.current.size > 0) {
        // oxlint-disable-next-line no-await-in-loop -- A change can start while the earlier ones land.
        await Promise.allSettled(sendingRef.current);
      }
    }

    /** The run ended, so nothing it does from here on counts. */
    function close() {
      clockRef.current = null;
    }

    return { close, flush, move, resend, runClock };
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

  return {
    closeClock: actions.close,
    flushClock: actions.flush,
    resendClock: actions.resend,
    runClock: actions.runClock,
  };
}
