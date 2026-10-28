"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { useEffect, useEffectEvent, useRef } from "react";
import { getAbandonEvent } from "./_utils/lesson-abandon";
import { type LessonPlayerState } from "./lesson-player-state";

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
