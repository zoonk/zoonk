"use client";

import { useCallback, useEffect, useRef } from "react";
import { isFocusLost } from "./is-focus-lost";

export type FocusTarget = () => HTMLElement | null | undefined;

type Saving = { control: Element | null; data: unknown; target?: FocusTarget };

/**
 * Call the returned function as a change starts. When `data` (the view the change brings back)
 * arrives without the control that had focus, focus moves to `target`, or else to `fallback`.
 * Pass a `fallback` that doesn't change between renders.
 */
export function useKeepFocus(data: unknown, fallback: FocusTarget) {
  const saving = useRef<Saving | null>(null);

  useEffect(() => {
    const saved = saving.current;

    if (!saved || saved.data === data) {
      return;
    }

    saving.current = null;

    if (saved.control && !saved.control.isConnected && isFocusLost(document.activeElement)) {
      (saved.target?.() ?? fallback())?.focus();
    }
  }, [data, fallback]);

  return useCallback(
    (target?: FocusTarget) => {
      saving.current = { control: document.activeElement, data, target };
    },
    [data],
  );
}

/** The row's "…" now at `index` in `list` (the next row, or the last when it was the end). */
export function findRowMenu(list: ParentNode | null | undefined, index: number) {
  const menus = list?.querySelectorAll<HTMLElement>("[data-slot=dropdown-menu-trigger]") ?? [];
  return menus[Math.min(index, menus.length - 1)];
}
