"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { useRef } from "react";
import { getAbandonEvent } from "./_utils/lesson-abandon";
import { type LessonPlayerState } from "./lesson-player-state";
import { usePageLifecycle } from "./use-page-lifecycle";

export function useAbandonTracking({
  state,
  track,
}: {
  state: LessonPlayerState;
  track: TrackEvent;
}): void {
  const sent = useRef(false);

  usePageLifecycle({
    onLeave: () => {
      const event = getAbandonEvent(state);

      if (sent.current || !event) {
        return;
      }

      sent.current = true;
      track(event, { instant: true });
    },
  });
}
