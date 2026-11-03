"use client";

import { useEffect } from "react";
import { activityRenderers } from "../activities/activity-registry";
import { type PlayableLibraryStep } from "./lesson-player-types";

function canvasTemplate(step: PlayableLibraryStep) {
  if (step.kind === "activity") {
    return step.content.template;
  }

  if (step.kind === "explanation") {
    return step.content.explore?.template;
  }

  return null;
}

export function usePreloadActivityCanvases(steps: readonly PlayableLibraryStep[]) {
  useEffect(() => {
    for (const step of steps) {
      const template = canvasTemplate(step);

      if (template) {
        void activityRenderers[template].load();
      }
    }
  }, [steps]);
}
