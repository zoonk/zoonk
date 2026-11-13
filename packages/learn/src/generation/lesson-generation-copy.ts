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

export function useChallengeCopy(): KindCopy<"challenge"> {
  const t = useExtracted();

  return {
    name: t("Writing your challenge"),
    phases: {
      fix: {
        label: t({
          description:
            'A step Zoonk shows while it prepares a challenge, after "Writing the challenge": its check found a problem, so Zoonk fixes it and checks the challenge again.',
          message: "Fixing what the check found",
        }),
        lines: [t("Rewriting the parts that didn't add up…"), t("Checking every path…")],
      },
      plan: {
        label: t("Planning the challenge"),
        lines: [t("Picking the situation…"), t("Mapping the choices you'll face…")],
      },
      write: {
        label: t("Writing the challenge"),
        lines: [t("Writing what each choice leads to…"), t("Checking every path…")],
      },
    },
  };
}
