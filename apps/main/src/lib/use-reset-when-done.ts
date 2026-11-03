"use client";

import { useLayoutEffect, useRef, useState } from "react";

/**
 * Next keeps a page mounted but hidden after the learner leaves it, so a form that already sent
 * its work would show it again when they come back, by a link or by Back. Key the form with `key`
 * and call `done()` when it sends: it starts over once the page is hidden, and words never sent stay.
 * https://nextjs.org/docs/app/guides/preserving-ui-state#resetting-stale-status-messages
 */
export function useResetWhenDone() {
  const [key, setKey] = useState(0);
  const isDone = useRef(false);

  useLayoutEffect(
    () => () => {
      if (isDone.current) {
        isDone.current = false;
        setKey((current) => current + 1);
      }
    },
    [],
  );

  return {
    done: () => {
      isDone.current = true;
    },
    key,
  };
}
