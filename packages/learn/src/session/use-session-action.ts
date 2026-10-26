"use client";

import { useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { safeAsync } from "@zoonk/utils/error";
import { useEffect, useRef, useState, useTransition } from "react";
import { useGoalSwitchPending } from "../shell/goal-switcher";

/**
 * Runs one of Today's actions from a button (or Enter, for the main one): it stays pending while
 * the host navigates, and says so when the action didn't work so the learner can try again. A
 * request that never got an answer (a phone that lost its connection) didn't work either: it
 * stays on this screen with that line instead of reaching the page's error screen.
 */
export function useSessionAction({
  action,
  enterKey = false,
  steadyMs = 0,
}: {
  action: () => Promise<boolean>;
  enterKey?: boolean;
  /**
   * How long after the screen shows a press is ignored: a second press meant for the screen before
   * it (Enter twice, a double tap where both screens put their main button) never skips this one.
   */
  steadyMs?: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const switching = useGoalSwitchPending();
  const shownAt = useRef<number | null>(null);

  useEffect(() => {
    shownAt.current = performance.now();
  }, []);

  const run = () => {
    const steady =
      steadyMs === 0 ||
      (shownAt.current !== null && performance.now() - shownAt.current >= steadyMs);

    if (!steady) {
      return false;
    }

    if (isPending || switching) {
      return;
    }

    setFailed(false);

    startTransition(async () => {
      const { data: ok } = await safeAsync(action);
      setFailed(!ok);
    });
  };

  useEnterKey(run, { enabled: enterKey && !switching });

  return { failed, isPending: isPending || switching, run };
}
