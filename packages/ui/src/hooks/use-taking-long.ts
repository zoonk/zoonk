"use client";

import { useEffect, useState } from "react";

/**
 * Whether something the person waits on (a grade, a start, a new version) has been `active` for
 * longer than it usually takes, so the screen can say it's still working instead of looking stuck.
 * It turns false again as soon as the wait ends.
 */
export function useTakingLong({ active, afterMs }: { active: boolean; afterMs: number }): boolean {
  const [isLong, setIsLong] = useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }

    const timer = setTimeout(() => setIsLong(true), afterMs);

    return () => {
      clearTimeout(timer);
      setIsLong(false);
    };
  }, [active, afterMs]);

  return active && isLong;
}
