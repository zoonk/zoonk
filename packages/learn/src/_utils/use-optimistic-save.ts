"use client";

import { showErrorToast } from "@zoonk/ui/components/toast";
import { safeAsync } from "@zoonk/utils/error";
import { useTransition } from "react";
import { useChangeSaveErrorMessage } from "../_components/save-error";

/**
 * A save that fails says so in a toast, so nothing on the screen moves to make room for it.
 * `onSaved` is for a save whose form stays on the screen, which has to say it went through.
 */
export function useOptimisticSave() {
  const failure = useChangeSaveErrorMessage();
  const [, startTransition] = useTransition();

  const run = (update: () => void, save: () => Promise<boolean>, onSaved?: () => void) => {
    startTransition(async () => {
      update();
      const { data: saved } = await safeAsync(save);

      if (saved) {
        onSaved?.();
      } else {
        showErrorToast(failure);
      }
    });
  };

  return { run };
}
