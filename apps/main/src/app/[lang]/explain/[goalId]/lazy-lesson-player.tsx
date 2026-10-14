"use client";

import { type LessonPlayerClient } from "@/app/[lang]/learn/[lessonId]/lesson-player-client";
import { createSharedImport } from "@/lib/shared-import";
import dynamic from "next/dynamic";
import { useEffect } from "react";

/** One load of the player per tab: one Today's link preloaded is the one the explanation uses. */
const importPlayer = createSharedImport<{ LessonPlayerClient: typeof LessonPlayerClient }>();

/**
 * The lesson player, out of the explanation's first load: the waiting screen starts loading it
 * while the explanation is written (`preloadLessonPlayer`). It still renders on the server for an
 * explanation opened ready.
 */
export const LazyLessonPlayer = dynamic(() =>
  importPlayer(() => import("@/app/[lang]/learn/[lessonId]/lesson-player-client")).then(
    (mod) => mod.LessonPlayerClient,
  ),
);

/** Starts loading the player before an explanation needs it, so it opens at once. */
export function preloadLessonPlayer() {
  void importPlayer(() => import("@/app/[lang]/learn/[lessonId]/lesson-player-client")).catch(
    () => null,
  );
}

/**
 * Shown with a link to an unfinished explanation (Today's): its player loads with the link, as
 * the link's prefetch loads the page, so tapping it opens the explanation at once.
 */
export function LessonPlayerPreload() {
  useEffect(() => {
    preloadLessonPlayer();
  }, []);

  return null;
}
