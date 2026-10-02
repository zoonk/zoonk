"use client";

import { useRef, useState } from "react";
import { keepArrowKeys } from "./keep-arrow-keys";

const ROVING_KEYS = ["ArrowDown", "ArrowLeft", "ArrowRight", "ArrowUp", "End", "Home"] as const;

type RovingKey = (typeof ROVING_KEYS)[number];

function isRovingKey(key: string): key is RovingKey {
  return ROVING_KEYS.some((rovingKey) => rovingKey === key);
}

function targetIndex({ count, index, key }: { count: number; index: number; key: string }) {
  const targets: Record<RovingKey, number> = {
    ArrowDown: index + 1,
    ArrowLeft: index - 1,
    ArrowRight: index + 1,
    ArrowUp: index - 1,
    End: count - 1,
    Home: 0,
  };

  const target = isRovingKey(key) ? targets[key] : null;
  return target === null ? null : Math.min(Math.max(target, 0), count - 1);
}

/**
 * One tab stop for a row of controls, like piano keys: the arrows, Home and End move between
 * them and Enter or Space presses the focused one.
 */
export function useRovingFocus(count: number) {
  const [active, setActive] = useState(0);
  const items = useRef<(HTMLElement | null)[]>([]);

  return (index: number) => ({
    onFocus: () => setActive(index),
    onKeyDown: (event: React.KeyboardEvent<HTMLElement>) => {
      keepArrowKeys(event);
      const next = targetIndex({ count, index, key: event.key });

      if (next === null) {
        return;
      }

      event.preventDefault();
      setActive(next);
      items.current[next]?.focus();
    },
    ref: (element: HTMLElement | null) => {
      items.current[index] = element;
    },
    tabIndex: index === Math.min(active, count - 1) ? 0 : -1,
  });
}
