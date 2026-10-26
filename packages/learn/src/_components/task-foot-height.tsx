"use client";

import { type RefObject, useLayoutEffect } from "react";

/**
 * Keeps the height of the buddy's dock at the foot of a task's aside in `--task-dock` on the task's
 * root, so what sits in the aside's body ends above it, whatever it holds: suggestions over the
 * composer, a composer grown to a few lines. A task without an aside measures nothing.
 */
export function useTaskFootHeight(ref: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const element = ref.current;
    const root = element?.closest<HTMLElement>("[data-aside]");

    if (!element || !root) {
      return;
    }

    const update = () => root.style.setProperty("--task-dock", `${element.offsetHeight}px`);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => {
      observer.disconnect();
      root.style.removeProperty("--task-dock");
    };
  }, [ref]);
}
