"use client";

import { type TrackEvent } from "@zoonk/core/analytics/events";
import { useEffect } from "react";
import { createVisibleWait } from "./visible-wait";

export function useVisibleWait({
  attemptId,
  contentKind,
  enabled = true,
  goalId,
  onboardingId,
  surface,
  track,
}: {
  attemptId?: string;
  contentKind: string;
  enabled?: boolean;
  goalId?: string | null;
  onboardingId?: string;
  surface: string;
  track: TrackEvent;
}): void {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const clock = createVisibleWait({
      at: Date.now(),
      visible: document.visibilityState === "visible",
    });

    const end = () => {
      const segment = clock.end(Date.now());

      if (segment) {
        track(
          {
            name: "Generation Waited",
            properties: {
              attempt_id: attemptId,
              content_kind: contentKind,
              ended_at: segment.endedAt,
              goal_id: goalId,
              milliseconds: segment.endedAt - segment.startedAt,
              onboarding_id: onboardingId,
              started_at: segment.startedAt,
              surface,
            },
          },
          { instant: true },
        );
      }
    };

    const visibility = () => {
      if (document.visibilityState === "visible") {
        clock.show(Date.now());
      } else {
        end();
      }
    };

    document.addEventListener("visibilitychange", visibility);
    window.addEventListener("pagehide", end);
    window.addEventListener("pageshow", visibility);

    return () => {
      document.removeEventListener("visibilitychange", visibility);
      window.removeEventListener("pagehide", end);
      window.removeEventListener("pageshow", visibility);
      end();
    };
  }, [attemptId, contentKind, enabled, goalId, onboardingId, surface, track]);
}
