"use client";

import { noteWitness, registerIdentityCover } from "@/lib/learner/learner-identity";
import { stopInputOnDeparture } from "@/lib/learner/stop-input-on-departure";

/** What a learner does to a page: each one is checked before the page hears it. */
const INPUT_EVENTS = ["pointerdown", "keydown", "click", "submit"] as const;

/**
 * Hands the parse-time cover to the learner store once, as this module loads: client modules load
 * before hydration runs any effect, so the store has the cover, the hint the page was parsed with
 * and the witnesses found so far before any boundary reports itself. Later witnesses go straight
 * to the store.
 */
function registerCover() {
  const runtime = globalThis.zoonkIdentityCover;

  if (!runtime) {
    globalThis.reportError(new Error("The identity cover's bootstrap didn't run"));
    return;
  }

  registerIdentityCover({
    cover: {
      cover: runtime.cover,
      coverFailed: runtime.coverFailed,
      reset: runtime.reset,
      uncover: runtime.uncover,
    },
    handoff: runtime.takeHandoff(noteWitness),
  });
}

if (typeof document !== "undefined") {
  registerCover();

  INPUT_EVENTS.forEach((type) => {
    globalThis.addEventListener(type, stopInputOnDeparture, true);
  });
}

/** Rendered once by the root layout, so the browser loads this module with the page. */
export function IdentityCoverBridge() {
  return null;
}
