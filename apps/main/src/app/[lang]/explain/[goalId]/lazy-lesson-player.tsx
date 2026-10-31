"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { importLessonPlayer, preloadLessonPlayer } from "./lesson-player-code";

export const LazyLessonPlayer = dynamic(() =>
  importLessonPlayer(() => import("@/app/[lang]/learn/[lessonId]/lesson-player-client")).then(
    (mod) => mod.LessonPlayerClient,
  ),
);

export function LessonPlayerPreload() {
  useEffect(() => {
    preloadLessonPlayer();
  }, []);

  return null;
}
