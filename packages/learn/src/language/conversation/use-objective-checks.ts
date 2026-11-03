"use client";

import {
  type ConversationTurn,
  type LanguageConversationView,
  type LanguageConversationObjectiveCheck as ObjectiveCheck,
} from "@zoonk/core/language/conversations/contract";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type LiveCallCue } from "./live-call-script";
import {
  NO_CHECK_TIMING,
  REPLY_SETTLED_MS,
  hearFragment,
  isCheckDue,
  readTranscript,
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
  const timing = useRef(NO_CHECK_TIMING);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    running.current = true;
    const snapshotAt = Date.now();
    const turns = getTurns();
    timing.current = readTranscript(timing.current);
    const found = await checkObjectives(turns).catch(() => null);
    running.current = false;

    if (found) {
      if (found.objectivesMet.length > met.current.length) {
        met.current = found.objectivesMet;
        setMetLabels(found.objectivesMet);
      }

      onChecked({ ...found, objectivesMet: met.current, snapshotAt });
    }
  }, [checkObjectives, getTurns, onChecked]);

  const clearSettle = useCallback(() => {
    if (settle.current) {
      clearTimeout(settle.current);
      settle.current = null;
    }
  }, []);

  /** Each fragment waits for the transcript to settle again; a check still running holds the next. */
  const hear = useCallback(
    (fragment: Parameters<typeof hearFragment>[1]) => {
      timing.current = hearFragment(timing.current, fragment);
      clearSettle();

      const settled = () => {
        if (running.current) {
          settle.current = setTimeout(settled, REPLY_SETTLED_MS);
          return;
        }

        settle.current = null;

        if (isCheckDue(timing.current)) {
          void check();
        }
      };

      settle.current = setTimeout(settled, REPLY_SETTLED_MS);
    },
    [check, clearSettle],
  );

  const onLearnerTurn = useCallback(
    (startMs?: number) => hear({ speaker: "learner", startMs }),
    [hear],
  );

  const onCharacterTurn = useCallback(
    (startMs: number) => hear({ speaker: "character", startMs }),
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
