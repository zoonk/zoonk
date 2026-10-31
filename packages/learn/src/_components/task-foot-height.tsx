"use client";

import { type RefObject, useLayoutEffect } from "react";

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
