"use client";

import { useState, useTransition } from "react";
import { useLearnAnalytics } from "../learn-context";
import { type PlanActions, usePlanScreen } from "./plan-context";

type ToolChoiceInput = Parameters<PlanActions["chooseTools"]>[0];

/**
 * Saves an answer on the "You'll use" card with a pending state and a failure flag, like the
 * plan's other controls. `onDone` runs once it's saved, such as closing the sheet. `focusAfter` is
 * where focus goes if the saved answer takes its control away.
 */
export function useToolChoice(focusAfter?: () => HTMLElement | null) {
  const { actions, keepFocus } = usePlanScreen();
  const analytics = useLearnAnalytics();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const choose = (input: ToolChoiceInput, onDone?: () => void) => {
    setFailed(false);

    if (focusAfter) {
      keepFocus(focusAfter);
    }

    startTransition(async () => {
      const ok = await actions.chooseTools(input);
      setFailed(!ok);

      if (ok) {
        analytics.track({ name: "Plan Edited", properties: { change_kind: "setTools" } });
        onDone?.();
      }
    });
  };

  return { choose, failed, isPending };
}
