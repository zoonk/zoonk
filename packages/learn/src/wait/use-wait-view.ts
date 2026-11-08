"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import { type ReadyHoldControl } from "./use-ready-hold";
import { type WaitQuizRefs } from "./wait-quiz";

export type WaitView = "progress" | "quiz";

/**
 * Marks the history entry the progress view pushed. On a narrow screen the progress shows exactly
 * while that entry is the current one, so every Back and Forward moves between the two views.
 */
const HISTORY_KEY = "zoonkWaitProgress";

/** Wide hosts show the progress in their aside, so the strip that opens it isn't drawn there. */
export const WAIT_NARROW_ONLY_CLASS = "min-[72rem]:hidden";

function isOwnEntry(entryId: string): boolean {
  const state: unknown = globalThis.history.state;

  return (
    typeof state === "object" &&
    state !== null &&
    HISTORY_KEY in state &&
    state[HISTORY_KEY] === entryId
  );
}

const historyListeners = new Set<() => void>();

function subscribeToHistory(onChange: () => void) {
  historyListeners.add(onChange);
  globalThis.addEventListener("popstate", onChange);

  return () => {
    historyListeners.delete(onChange);
    globalThis.removeEventListener("popstate", onChange);
  };
}

/** Pushing fires no popstate, so the screens following history hear it here. */
function pushProgressEntry(entryId: string) {
  if (isOwnEntry(entryId)) {
    return;
  }

  globalThis.history.pushState({ ...globalThis.history.state, [HISTORY_KEY]: entryId }, "");

  for (const onChange of historyListeners) {
    onChange();
  }
}

/**
 * Only the learner's own switches move focus: opening the progress focuses its heading, going back
 * focuses the strip, or the question where no strip is drawn. A resize or a card arriving doesn't.
 */
function useSwitchFocus({
  chosen,
  questionRef,
  view,
}: {
  chosen: WaitView;
  questionRef: WaitQuizRefs["questionRef"];
  view: WaitView;
}) {
  const contentRef = useRef<HTMLDivElement>(null);
  const statusRef = useRef<HTMLButtonElement>(null);
  const shown = useRef({ chosen, view });

  useEffect(() => {
    const before = shown.current;
    shown.current = { chosen, view };

    if (before.chosen === chosen || before.view === view) {
      return;
    }

    if (view === "progress") {
      const content = contentRef.current;
      (content?.querySelector<HTMLElement>("h1, h2") ?? content)?.focus();
    } else {
      const status = statusRef.current;
      (status?.checkVisibility() ? status : questionRef.current)?.focus();
    }
  }, [chosen, questionRef, view]);

  return { contentRef, statusRef };
}

/**
 * The quiz is the default view. A screen that first showed without a card stays on the progress when
 * one arrives, so the page never changes under the learner; its bar offers the quiz instead.
 */
export function useWaitView({
  hasQuiz,
  hold,
  questionRef,
}: {
  hasQuiz: boolean;
  hold: ReadyHoldControl;
  questionRef: WaitQuizRefs["questionRef"];
}) {
  const entryId = useId();
  const [base, setBase] = useState<WaitView>(() => (hasQuiz ? "quiz" : "progress"));
  const [switched, setSwitched] = useState(false);

  const opened = useSyncExternalStore(
    subscribeToHistory,
    () => isOwnEntry(entryId),
    () => false,
  );

  const chosen: WaitView = opened ? "progress" : base;
  const view: WaitView = hasQuiz ? chosen : "progress";
  const { contentRef, statusRef } = useSwitchFocus({ chosen, questionRef, view });

  const openProgress = () => {
    setSwitched(true);
    hold.engage();
    pushProgressEntry(entryId);
  };

  const backToQuiz = () => {
    setSwitched(true);
    globalThis.history.back();
  };

  const playQuiz = () => {
    setSwitched(true);
    setBase("quiz");
    hold.engage();
  };

  const release = () => {
    if (isOwnEntry(entryId)) {
      globalThis.history.back();
    }

    hold.release();
  };

  return {
    back: opened && view === "progress" && hasQuiz ? backToQuiz : null,
    contentRef,
    openProgress,
    playQuiz,
    release,
    statusRef,
    switched,
    view,
  };
}
