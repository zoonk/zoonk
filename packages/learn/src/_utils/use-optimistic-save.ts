"use client";

import { showErrorToast } from "@zoonk/ui/components/toast";
import { safeAsync } from "@zoonk/utils/error";
import { useTransition } from "react";
import { useChangeSaveErrorMessage } from "../_components/save-error";

/** A save that fails says so in a toast, so nothing on the screen moves to make room for it. */
export function useOptimisticSave() {
  const failure = useChangeSaveErrorMessage();
  const [, startTransition] = useTransition();

  const run = (update: () => void, save: () => Promise<boolean>) => {
    startTransition(async () => {
      update();
      const { data: saved } = await safeAsync(save);

      if (!saved) {
        showErrorToast(failure);
      }
    });
  };

  return { run };
}
