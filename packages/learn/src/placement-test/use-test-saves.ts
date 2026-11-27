"use client";

import { useRef, useState, useTransition } from "react";
import { type TestPressed } from "./test-offer";

/**
 * A test screen's saves: which button is busy, whether the last one failed, and whether the learner
 * has pressed anything since the screen was read, so a read that comes back late doesn't replace
 * what their press put on screen.
 */
export function useTestSaves() {
  const [failed, setFailed] = useState(false);
  const [pressed, setPressed] = useState<TestPressed>(null);
  const [isPending, startTransition] = useTransition();
  const acted = useRef(false);

  const run = (action: () => Promise<void>) => {
    acted.current = true;
    setFailed(false);
    startTransition(action);
  };

  return {
    failed,
    hasActed: () => acted.current,
    isPending,
    markRead: () => {
      acted.current = false;
    },
    pressed,
    /** For a save with its own failure state, such as an answer counted on its question. */
    run,
    save: (button: TestPressed, action: () => Promise<boolean>) => {
      setPressed(button);

      run(async () => {
        const saved = await action().catch(() => false);
        setFailed(!saved);
        setPressed(null);
      });
    },
    setFailed,
  };
}
