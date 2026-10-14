"use client";

import { useCallback } from "react";

/**
 * A swipe row takes the keyboard's focus only while it scrolls: the server renders it focusable
 * (so it scrolls by keyboard before scripts run), and from then on it leaves the tab order
 * whenever its items fit, as they do side by side from `lg`.
 */
export function useScrollRowFocus<Element extends HTMLElement>() {
  return useCallback((element: Element | null) => {
    if (!element) {
      return;
    }

    const update = () => {
      element.tabIndex = element.scrollWidth > element.clientWidth ? 0 : -1;
    };

    const observer = new ResizeObserver(update);
    observer.observe(element);
    update();

    return () => observer.disconnect();
  }, []);
}
