"use client";

import { isPicturePending } from "@zoonk/core/lesson-player/picture-policy";
import { type LessonMarks } from "@zoonk/core/lesson-player/playable-lesson";
import { type StepMarks } from "@zoonk/core/library/marks/contract";
import { usePoll } from "@zoonk/learn/poll";
import { useMountTime } from "@zoonk/ui/hooks/mount-time";
import { useMemo, useState } from "react";
import { isLanguageStep } from "./_utils/lesson-steps";
import { useLessonPlayerConfig } from "./lesson-player-context";
import {
  type LessonPlayerAdapters,
  type PlayableLibraryLesson,
  type PlayableLibraryStep,
} from "./lesson-player-types";

function isInPictureWait({
  now,
  startedAt,
  steps,
}: {
  now: number;
  startedAt: number;
  steps: readonly PlayableLibraryStep[];
}): boolean {
  return steps.some(
    (step) =>
      !isLanguageStep(step) &&
      isPicturePending({ now, startedAt: step.pictureWaitStartedAt ?? startedAt }),
  );
}

const POLL_MS = 4000;

/** Marks, `about` lines and icons tagged after the lesson's first read, read again while they're on their way. */
export function useArrivingMarks({
  getLessonMarks,
  lesson,
}: {
  getLessonMarks: LessonPlayerAdapters["getLessonMarks"];
  lesson: Pick<PlayableLibraryLesson, "id" | "marksPending" | "steps">;
}): LessonMarks | null {
  const startedAt = useMountTime().getTime();
  const [arrived, setArrived] = useState<LessonMarks | null>(null);
  const [isPastWait, setIsPastWait] = useState(false);
  const isPending = arrived?.marksPending ?? lesson.marksPending;

  usePoll({
    active: Boolean(getLessonMarks) && isPending && !isPastWait,
    intervalMs: POLL_MS,
    key: lesson.id,
    onPoll: async () => {
      if (!isInPictureWait({ now: Date.now(), startedAt, steps: lesson.steps })) {
        setIsPastWait(true);
        return;
      }

      // A failed read is retried on the next round: the picture wait, not an error count, ends it.
      const read = await getLessonMarks?.().catch(() => null);

      if (read) {
        setArrived(read);
      }
    },
  });

  return arrived;
}

/**
 * The screen the learner is reading keeps the layout it opened with: an arriving underline shows in
 * place, while its strip, example frame and icon wait for the next visit, so nothing moves under
 * their eyes.
 */
export function useShownMarks({
  isShown,
  step,
}: {
  isShown: boolean;
  step: PlayableLibraryStep;
}): StepMarks | null {
  const { arrivedMarks } = useLessonPlayerConfig();
  const own = isLanguageStep(step) ? null : step.marks;
  const latest = arrivedMarks?.has(step.id) ? (arrivedMarks.get(step.id) ?? null) : own;
  const [view, setView] = useState({ isShown, marks: latest });

  if (view.isShown !== isShown || (!isShown && view.marks !== latest)) {
    setView({ isShown, marks: latest });
  }

  const opened = view.marks;
  const underline = latest?.underline ?? null;

  return useMemo(() => {
    if (!isShown) {
      return latest;
    }

    if (!opened && !underline) {
      return null;
    }

    return opened?.underline === underline
      ? opened
      : {
          example: opened?.example ?? null,
          icon: opened?.icon ?? null,
          ideaIndex: opened?.ideaIndex ?? null,
          underline,
        };
  }, [isShown, latest, opened, underline]);
}
