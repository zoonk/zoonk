"use client";

import {
  type ConversationTurn,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { formatObjectivesProgressCue } from "@zoonk/core/language/conversations/live-call-cues";
import { type RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sendLiveCallCue } from "./live-call-commands";
import { type LiveCallSession } from "./live-call-session";

const REPLY_SETTLED_MS = 1500;

type CheckObjectives = (turns: ConversationTurn[]) => Promise<string[] | null>;

const skipObjectiveChecks = () => Promise.resolve(null);

function useObjectiveChecks({
  checkObjectives,
  conversation,
  getTurns,
  onChange,
}: {
  checkObjectives: CheckObjectives;
  conversation: LanguageConversationView;
  getTurns: () => ConversationTurn[];
  onChange: (met: string[]) => void;
}) {
  const [metLabels, setMetLabels] = useState(() =>
    conversation.objectives
      .filter((objective) => objective.met)
      .map((objective) => objective.label),
  );

  const met = useRef(metLabels);
  const running = useRef(false);
  const again = useRef(false);
  const learnerSpoke = useRef(false);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);

  const check = useCallback(async () => {
    if (running.current) {
      again.current = true;
      return;
    }

    running.current = true;

    do {
      again.current = false;
      // oxlint-disable-next-line no-await-in-loop -- One check at a time, then one more for turns that ended meanwhile.
      const found = await checkObjectives(getTurns()).catch(() => null);

      if (found && found.length > met.current.length) {
        met.current = found;
        setMetLabels(found);
        onChange(found);
      }
    } while (again.current);

    running.current = false;
  }, [checkObjectives, getTurns, onChange]);

  const clearSettle = useCallback(() => {
    if (settle.current) {
      clearTimeout(settle.current);
      settle.current = null;
    }
  }, []);

  const onLearnerTurn = useCallback(() => {
    learnerSpoke.current = true;
    clearSettle();
  }, [clearSettle]);

  const onCharacterTurn = useCallback(() => {
    if (!learnerSpoke.current) {
      return;
    }

    clearSettle();

    settle.current = setTimeout(() => {
      learnerSpoke.current = false;
      void check();
    }, REPLY_SETTLED_MS);
  }, [check, clearSettle]);

  useEffect(() => clearSettle, [clearSettle]);

  return { metLabels, onCharacterTurn, onLearnerTurn };
}

export function useCallObjectives({
  checkObjectives,
  conversation,
  getTurns,
  sessionRef,
}: {
  checkObjectives: CheckObjectives;
  conversation: LanguageConversationView;
  getTurns: () => ConversationTurn[];
  sessionRef: RefObject<LiveCallSession | null>;
}) {
  const labels = useMemo(() => conversation.objectives.map((item) => item.label), [conversation]);

  const onChange = useCallback(
    (met: string[]) => {
      if (sessionRef.current) {
        sendLiveCallCue({
          channel: "thinking",
          content: formatObjectivesProgressCue({
            met,
            open: labels.filter((label) => !met.includes(label)),
          }),
          session: sessionRef.current,
        });
      }
    },
    [labels, sessionRef],
  );

  const check = conversation.examTask ? skipObjectiveChecks : checkObjectives;
  return useObjectiveChecks({ checkObjectives: check, conversation, getTurns, onChange });
}
