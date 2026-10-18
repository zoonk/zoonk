"use client";

import { useRouter } from "@/i18n/navigation";
import { useEffect } from "react";
import { takeSettledAppWrites } from "./app-write-ledger";

/**
 * On a screen that saves through the app's routes: refreshes the router once when it closes, after
 * the writes it sent settle, so the page the learner goes to and every page the router kept show
 * what they changed (see `app-write-ledger.ts`).
 */
export function useRefreshAfterAppWrites(): void {
  const router = useRouter();

  useEffect(
    () => () => {
      void takeSettledAppWrites().then((wrote) => {
        if (wrote) {
          router.refresh();
        }
      });
    },
    [router],
  );
}
