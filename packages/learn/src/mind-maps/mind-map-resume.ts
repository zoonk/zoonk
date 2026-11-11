"use client";

import { isUuid } from "@zoonk/utils/uuid";
import { useSyncExternalStore } from "react";
import { deviceStorage } from "../_utils/device-storage";
import { type MindMapPlace, type MindMapTab } from "./_utils/mind-map-urls";

type ResumeKey = { goalId: string; view: MindMapTab };

const SEPARATOR = "/";

const listeners = new Set<() => void>();

function storageKey({ goalId, view }: ResumeKey): string {
  return `zoonk:mind-maps:resume:${goalId}:${view}`;
}

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  return () => listeners.delete(onChange);
}

function parsePlace(stored: string | null): MindMapPlace | null {
  const [chapterId, lessonId] = stored?.split(SEPARATOR) ?? [];

  if (!chapterId || !isUuid(chapterId)) {
    return null;
  }

  return { chapterId, lessonId: lessonId && isUuid(lessonId) ? lessonId : null };
}

/** Null clears it, as finishing a deck does, so the next study starts from its first map. */
export function keepMindMapPlace(key: ResumeKey, place: MindMapPlace | null) {
  if (place) {
    const parts = [place.chapterId, ...(place.lessonId ? [place.lessonId] : [])];
    deviceStorage.set(storageKey(key), parts.join(SEPARATOR));
  } else {
    deviceStorage.remove(storageKey(key));
  }

  listeners.forEach((notify) => notify());
}

/** Where the learner stopped in this deck on this device; null on the server and until they study. */
export function useMindMapPlace(key: ResumeKey): MindMapPlace | null {
  const stored = useSyncExternalStore(
    subscribe,
    () => deviceStorage.get(storageKey(key)),
    () => null,
  );

  return parsePlace(stored);
}
