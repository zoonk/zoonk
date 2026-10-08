"use client";

import {
  type ConversationTurn,
  type LanguageConversationView,
} from "@zoonk/core/language/conversations/contract";
import { useCallback, useEffect, useRef, useState } from "react";

/** The character's answer has settled once its transcript stays quiet this long. */
const REPLY_SETTLED_MS = 1500;

/**
 * The call's goals, marked while the learner talks: once the character has answered a learner
 * turn, the host checks the transcript so far, so an agreement or a test part moving on is in it.
 * One check runs at a time; a turn that ends meanwhile is checked right after it. `onChange` hears
 * every change, so the voice model can be told where the learner is.
 */
export function useObjectiveChecks({
  checkObjectives,
  conversation,
  getTurns,
  onChange,
}: {
  checkObjectives: (turns: ConversationTurn[]) => Promise<string[] | null>;
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

  /** The learner is talking or typed a reply: the next answer from the character gets checked. */
  const onLearnerTurn = useCallback(() => {
    learnerSpoke.current = true;
    clearSettle();
  }, [clearSettle]);

  /** The character is answering: check once its answer settles. */
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
