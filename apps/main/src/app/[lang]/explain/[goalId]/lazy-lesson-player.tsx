"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { importLessonPlayer, preloadLessonPlayer } from "./lesson-player-code";

/**
 * The lesson player, out of the explanation's first load: the waiting screen starts loading it
 * while the explanation is written (`preloadLessonPlayer`). It still renders on the server for an
 * explanation opened ready.
 */
export const LazyLessonPlayer = dynamic(() =>
  importLessonPlayer(() => import("@/app/[lang]/learn/[lessonId]/lesson-player-client")).then(
    (mod) => mod.LessonPlayerClient,
  ),
);

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
