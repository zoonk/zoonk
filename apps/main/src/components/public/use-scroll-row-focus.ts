"use client";

import { useCallback } from "react";

/** The server renders the row focusable, so it scrolls by keyboard before scripts run. */
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
