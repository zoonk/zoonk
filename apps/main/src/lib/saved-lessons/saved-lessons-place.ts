"use client";

import { type LearnerSummaryPlaces } from "@zoonk/core/learner/summary/contract";
import { useLayoutEffect, useSyncExternalStore } from "react";

let held = false;
const listeners = new Set<() => void>();

function setHeld(value: boolean) {
  held = value;

  for (const listener of listeners) {
    listener();
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/**
 * Saved lessons keeps its place in the frame while it shows the saves it was served, as its bar
 * does, whatever the summary says since: removing the last save there takes the place away once
 * the learner leaves.
 */
export function useHoldSavedLessonsPlace(hold: boolean): void {
  useLayoutEffect(() => {
    if (!hold) {
      return;
    }

    setHeld(true);
    return () => setHeld(false);
  }, [hold]);
}

/** The places the frame lists: the summary's, with Saved lessons while its page holds it. */
export function useListedPlaces(places: LearnerSummaryPlaces): LearnerSummaryPlaces {
  const isHeld = useSyncExternalStore(
    subscribe,
    () => held,
    () => false,
  );

  return isHeld && !places.savedLessons ? { ...places, savedLessons: true } : places;
}
