"use client";

import { useExtracted } from "next-intl";
import { type KindCopy } from "./generation-copy-types";

export function useLessonCopy(): KindCopy<"lesson"> {
  const t = useExtracted();

  return {
    name: t("Writing your lesson"),
    phases: {
      draw: t({
        description:
          'A step Zoonk shows while it prepares a lesson, saying what it is doing, like "Planning the lesson" and "Writing the lesson" before it.',
        message: "Drawing the pictures",
      }),
      mark: t({
        description:
          'A step Zoonk shows while it prepares a lesson, saying what it is doing, like "Planning the lesson" and "Writing the lesson" before it. "Ideas" are the lesson map\'s ideas, as in "Idea 2 of 4".',
        message: "Highlighting the key ideas",
      }),
      plan: t("Planning the lesson"),
      write: t("Writing the lesson"),
    },
  };
}
