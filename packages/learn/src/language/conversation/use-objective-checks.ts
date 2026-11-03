"use client";

import {
  type ConversationTurn,
  type LanguageConversationView,
  type LanguageConversationObjectiveCheck as ObjectiveCheck,
} from "@zoonk/core/language/conversations/contract";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type LiveCallCue } from "./live-call-script";
import {
  type CheckTimingEvent,
  NO_CHECK_TIMING,
  REPLY_SETTLED_MS,
  stepCheckTiming,
} from "./objective-check-timing";

/** What a check found, for the transcript as it was at `snapshotAt`. */
export type ObjectiveCheckResult = {
  allMet: boolean;
  goodbye: boolean;
  progress: LiveCallCue | null;
  snapshotAt: number;
};

type CheckObjectives = (turns: ConversationTurn[]) => Promise<ObjectiveCheck | null>;

const skipObjectiveChecks = () => Promise.resolve(null);

function useObjectiveChecks({
  checkObjectives,
  conversation,
  getTurns,
  onChecked,
}: {
  checkObjectives: CheckObjectives;
  conversation: LanguageConversationView;
  getTurns: () => ConversationTurn[];
  onChecked: (check: ObjectiveCheck & { snapshotAt: number }) => void;
}) {
  const [metLabels, setMetLabels] = useState(() =>
    conversation.objectives
      .filter((objective) => objective.met)
      .map((objective) => objective.label),
  );

  const met = useRef(metLabels);
  const running = useRef(false);
  const again = useRef(false);
  const timing = useRef(NO_CHECK_TIMING);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    if (running.current) {
      again.current = true;
      return;
    }

    running.current = true;

    do {
      again.current = false;
      const snapshotAt = Date.now();
      // oxlint-disable-next-line no-await-in-loop -- One check at a time, then one more for turns that ended meanwhile.
      const found = await checkObjectives(getTurns()).catch(() => null);

      if (found) {
        if (found.objectivesMet.length > met.current.length) {
          met.current = found.objectivesMet;
          setMetLabels(found.objectivesMet);
        }

        onChecked({ ...found, objectivesMet: met.current, snapshotAt });
      }
    } while (again.current);

    running.current = false;
  }, [checkObjectives, getTurns, onChecked]);

  const clearSettle = useCallback(() => {
    if (settle.current) {
      clearTimeout(settle.current);
      settle.current = null;
    }
  }, []);

  const hear = useCallback(
    (event: CheckTimingEvent) => {
      const step = stepCheckTiming(timing.current, event);
      timing.current = step.timing;

      if (step.settle === "cancel") {
        clearSettle();
      }

      if (step.settle === "restart") {
        clearSettle();

        settle.current = setTimeout(() => {
          settle.current = null;
          timing.current = stepCheckTiming(timing.current, { type: "checked" }).timing;
          void check();
        }, REPLY_SETTLED_MS);
      }
    },
    [check, clearSettle],
  );

  const onLearnerTurn = useCallback(
    (startMs?: number) => hear({ startMs, type: "learner" }),
    [hear],
  );

  const onCharacterTurn = useCallback(
    (startMs: number) => hear({ startMs, type: "character" }),
    [hear],
  );

  useEffect(() => clearSettle, [clearSettle]);

  return { metLabels, onCharacterTurn, onLearnerTurn };
}

export function useCallObjectives({
  checkObjectives,
  conversation,
  getTurns,
  onResult,
}: {
  checkObjectives: CheckObjectives;
  conversation: LanguageConversationView;
  getTurns: () => ConversationTurn[];
  onResult: (result: ObjectiveCheckResult) => void;
}) {
  const labels = useMemo(() => conversation.objectives.map((item) => item.label), [conversation]);

  const onChecked = useCallback(
    ({ goodbye, objectivesMet, progress, snapshotAt }: ObjectiveCheck & { snapshotAt: number }) =>
      onResult({
        allMet: labels.length > 0 && labels.every((label) => objectivesMet.includes(label)),
        goodbye,
        progress,
        snapshotAt,
      }),
    [labels, onResult],
  );

  const check = conversation.examTask ? skipObjectiveChecks : checkObjectives;
  return useObjectiveChecks({ checkObjectives: check, conversation, getTurns, onChecked });
}
