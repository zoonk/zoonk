"use client";

import { useRouter } from "@/i18n/navigation";
import { useEffect } from "react";
import { takeSettledAppWrites } from "./app-write-ledger";

/**
 * On a screen whose writes don't render the page again (`noteAppWrite`): refreshes the router once
 * when it closes, after those writes settle, so the page the learner goes to and every page the
 * router kept show what they changed.
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
