"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useCallback, useRef, useState } from "react";
import {
  type LessonPlayerAdapters,
  type PlayableLibraryLesson,
  type PlayableLibraryStep,
} from "./lesson-player-types";

function hasExampleLineSlot(step: PlayableLibraryStep): boolean {
  return step.kind === "explanation" && Boolean(step.content.exampleLineSlot);
}

/**
 * The learner's personal examples for the lesson, written in the background so a screen with a
 * slot shows its line without the learner asking, or nothing when none fits. Writing starts from
 * the learner's first action in the lesson, never as it opens (a page load must not start AI
 * work), so the lines are usually ready by the time the learner reaches those screens. Asking for
 * one screen writes every screen's line in one call, so it's asked once, for the first. `writing`
 * is that call, null until it starts; it never rejects, and a refused or failed one isn't retried.
 */
export function useExampleLines({
  adapters,
  steps,
}: {
  adapters: LessonPlayerAdapters;
  steps: PlayableLibraryLesson["steps"];
}) {
  const [writing, setWriting] = useState<Promise<unknown> | null>(null);
  const isStartedRef = useRef(false);
  const { requestExampleLine } = adapters;

  const write = useCallback(() => {
    const first = steps.find((step) => hasExampleLineSlot(step));

    if (isStartedRef.current || !first || !requestExampleLine) {
      return;
    }

    isStartedRef.current = true;
    setWriting(safeAsync(() => requestExampleLine({ stepId: first.id })));
  }, [requestExampleLine, steps]);

  return { write, writing };
}
