"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { useEffect, useEffectEvent, useRef } from "react";
import { getAbandonEvent } from "./_utils/lesson-abandon";
import { type LessonPlayerState } from "./lesson-player-state";

/**
 * Sends "Activity Abandoned" once when the learner leaves an unfinished lesson: by leaving the
 * player (it unmounts) or by closing the page (`pagehide`, sent at once so it isn't lost with the
 * page). Finishing the lesson never sends it.
 */
export function useAbandonTracking({
  state,
  track,
}: {
  state: LessonPlayerState;
  track: TrackEvent;
}): void {
  const sent = useRef(false);

  const report = useEffectEvent(() => {
    const event = getAbandonEvent(state);

    if (sent.current || !event) {
      return;
    }

    sent.current = true;
    track(event, { instant: true });
  });

  useEffect(() => {
    const onPageHide = () => report();
    window.addEventListener("pagehide", onPageHide);

    return () => {
      window.removeEventListener("pagehide", onPageHide);
      report();
    };
  }, []);
}
