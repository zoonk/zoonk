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

/** Start writing only from a learner action; `writing` never rejects and failed writes are not retried. */
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
