"use client";

import { safeAsync } from "@zoonk/utils/error";
import { useState, useTransition } from "react";

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
