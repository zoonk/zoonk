"use client";

import { useEffect, useState } from "react";

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
