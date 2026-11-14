"use client";

import { useRouter } from "@/i18n/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

/**
 * Next keeps a page mounted but hidden after the learner leaves it, so a form that already sent
 * its work would show it again when they come back, by a link or by Back. Key the form with `key`
 * and call `done()` when it sends: it starts over once the page is hidden, and words never sent stay.
 * https://nextjs.org/docs/app/guides/preserving-ui-state#resetting-stale-status-messages
 *
 * A screen built from the server's `data` starts over from fresh data, not from the copy it
 * finished with: while `data` is still that copy, `stale` is true and the page reads it again.
 */
export function useResetWhenDone<Data>(data?: Data) {
  const router = useRouter();
  const [key, setKey] = useState(0);
  const [finishedWith, setFinishedWith] = useState<{ data: Data | undefined } | null>(null);
  const isDone = useRef(false);
  const doneData = useRef<Data | undefined>(undefined);
  const stale = data !== undefined && finishedWith?.data === data;

  useLayoutEffect(
    () => () => {
      if (isDone.current) {
        isDone.current = false;
        setKey((current) => current + 1);
        setFinishedWith({ data: doneData.current });
      }
    },
    [],
  );

  useEffect(() => {
    if (stale) {
      router.refresh();
    }
  }, [router, stale]);

  return {
    done: () => {
      isDone.current = true;
      doneData.current = data;
    },
    key,
    stale,
  };
}
