"use client";

import { type SaveLessonInput } from "@zoonk/core/saved-lessons/contract";
import { useExtracted } from "next-intl";
import { useSaves } from "../saves/use-saves";

/** Resolves to whether the lesson is saved now, or null when it couldn't be stored. */
export type SaveLesson = (input: SaveLessonInput) => Promise<boolean | null>;

export function useLessonSaves(save: SaveLesson) {
  const t = useExtracted();

  return useSaves<string>({
    failed: {
      remove: t("Couldn't remove this lesson. Try again."),
      save: t("Couldn't save this lesson. Try again."),
    },
    keyOf: (lessonId) => lessonId,
    save: (lessonId, saved) => save({ lessonId, saved }),
  });
}

export type LessonSaves = ReturnType<typeof useLessonSaves>;
