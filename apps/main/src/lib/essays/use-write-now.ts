"use client";

import { useRouter } from "@/i18n/navigation";
import { useCallback } from "react";
import { writeNowFromBrowser } from "./writing-requests";
import { handOverWritingStart } from "./writing-start-handoff";

/** "Write" on a page: starts a written task the learner asked for and opens it. */
export function useWriteNow() {
  const router = useRouter();

  return useCallback(
    async (input: { goalId: string; taskKey?: string }): Promise<boolean> => {
      const written = await writeNowFromBrowser(input);

      if (written) {
        router.push(handOverWritingStart(written));
      }

      return Boolean(written);
    },
    [router],
  );
}
