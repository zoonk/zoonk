"use client";

import { useEnterKey } from "@zoonk/ui/hooks/keyboard";
import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";
import { useSteady } from "../_utils/use-steady";
import { useGoalSwitchPending } from "../shell/goal-switcher";

export function useSessionAction({
  action,
  enterKey = false,
  steadyMs = 0,
}: {
  action: () => Promise<boolean>;
  enterKey?: boolean;
  steadyMs?: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [failed, setFailed] = useState(false);
  const switching = useGoalSwitchPending();
  const isSteady = useSteady(steadyMs);

  const run = () => {
    if (!isSteady()) {
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
