"use client";

import { useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { useState, useTransition } from "react";

/**
 * Runs one of Today's actions from a button (or Enter, for the main one): it stays pending while
 * the host navigates, and says so when the action didn't work so the learner can try again.
 */
export function useSessionAction({
  action,
  enterKey = false,
}: {
  action: () => Promise<boolean>;
  enterKey?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);

  const run = () => {
    if (isPending) {
      return;
    }

    setFailed(false);

    startTransition(async () => {
      const ok = await action();
      setFailed(!ok);
    });
  };

  useEnterKey(run, { enabled: enterKey });

  return { failed, isPending, run };
}
