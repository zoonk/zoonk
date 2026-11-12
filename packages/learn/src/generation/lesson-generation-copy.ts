"use client";

import { useExtracted } from "next-intl";
import { type KindCopy } from "./generation-copy-types";

export function useLessonCopy(): KindCopy<"lesson"> {
  const t = useExtracted();

  return {
    name: t("Writing your lesson"),
    phases: {
      draw: {
        label: t({
          description:
            'A step Zoonk shows while it prepares a lesson, saying what it is doing, like "Planning the lesson" and "Writing the lesson" before it.',
          message: "Drawing the pictures",
        }),
        lines: [
          t("Drawing what each screen describes…"),
          t({
            description:
              'Zoonk at work on a lesson. "Idea" is one of the lesson map\'s ideas, as in "Idea 2 of 4".',
            message: "Drawing an icon for each idea…",
          }),
        ],
      },
      mark: {
        label: t({
          description:
            'A step Zoonk shows while it prepares a lesson, saying what it is doing, like "Planning the lesson" and "Writing the lesson" before it. "Ideas" are the lesson map\'s ideas, as in "Idea 2 of 4".',
          message: "Highlighting the key ideas",
        }),
        lines: [
          t("Underlining what matters most…"),
          t({
            description:
              'Zoonk at work on a lesson. "Idea" is one of the lesson map\'s ideas, as in "Idea 2 of 4".',
            message: "Matching each screen to its idea…",
          }),
        ],
      },
      plan: {
        label: t("Planning the lesson"),
        lines: [
          t("Choosing what to cover…"),
          t({
            description: 'Zoonk at work on a lesson. "It" is the lesson\'s topic.',
            message: "Picking the best way to explain it…",
          }),
        ],
      },
      write: {
        label: t("Writing the lesson"),
        lines: [],
        numbered: {
          count: 6,
          line: (number) => t("Writing screen {number}…", { number: String(number) }),
          review: t("Checking the answers…"),
        },
      },
    },
  };
}
