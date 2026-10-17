"use client";

import { useEffect, useRef, useState } from "react";
import { type Layout } from "./molecule-layout";

const DURATION_MS = 240;
const EASE_POWER = 3;

function blend({ from, share, to }: { from: Layout; share: number; to: Layout }): Layout {
  return Object.fromEntries(
    Object.entries(to).map(([id, end]) => {
      const start = from[id] ?? end;

      return [
        id,
        { x: start.x + (end.x - start.x) * share, y: start.y + (end.y - start.y) * share },
      ];
    }),
  );
}

/**
 * The layout as drawn: atoms glide to their new places after each change, so bonds and atoms
 * move together. With reduced motion the new layout shows at once.
 */
export function useTweenedLayout(target: Layout, instant: boolean): Layout {
  const [shown, setShown] = useState(target);
  const shownRef = useRef(target);

  useEffect(() => {
    if (instant) {
      shownRef.current = target;
      return;
    }

    const from = shownRef.current;
    const start = performance.now();
    const frame = { id: 0 };

    function tick(now: number) {
      const progress = Math.min((now - start) / DURATION_MS, 1);
      const next = blend({ from, share: 1 - (1 - progress) ** EASE_POWER, to: target });

      shownRef.current = next;
      setShown(next);

      if (progress < 1) {
        frame.id = requestAnimationFrame(tick);
      }
    }

    frame.id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.id);
  }, [instant, target]);

  return instant ? target : blend({ from: shown, share: 0, to: target });
}
