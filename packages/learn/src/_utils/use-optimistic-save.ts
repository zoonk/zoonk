"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";

/**
 * Shows a setting's change at once and saves it in the background. The screen goes back to the
 * saved value on its own when the save fails, and `failed` says so.
 */
export function useOptimisticSave() {
  const [failed, setFailed] = useState(false);
  const [, startTransition] = useTransition();

  const run = (update: () => void, save: () => Promise<boolean>) => {
    setFailed(false);

    startTransition(async () => {
      update();
      const { data: saved } = await safeAsync(save);
      setFailed(!saved);
    });
  };

  return { failed, run };
}
