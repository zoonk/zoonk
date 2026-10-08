"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { useLearnAnalytics } from "../learn-context";
import { type PlanActions, usePlanScreen } from "./plan-context";

type ToolChoiceInput = Parameters<PlanActions["chooseTools"]>[0];

/**
 * Saves an answer on the "You'll use" card with a pending state and a failure flag, like the
 * plan's other controls. `onDone` runs once it's saved, such as closing the sheet.
 */
export function useToolChoice() {
  const { actions } = usePlanScreen();
  const analytics = useLearnAnalytics();
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const choose = (input: ToolChoiceInput, onDone?: () => void) => {
    setFailed(false);

    startTransition(async () => {
      const { data: ok } = await safeAsync(() => actions.chooseTools(input));
      setFailed(!ok);

      if (ok) {
        analytics.track({ name: "Plan Edited", properties: { change_kind: "setTools" } });
        onDone?.();
      }
    });
  };

  return { choose, failed, isPending };
}
