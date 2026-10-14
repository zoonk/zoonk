"use client";

import { type RefObject, useLayoutEffect } from "react";

/** The buddy at the foot of a task's aside from `lg`, level with the action bar. */
export const TUTOR_DOCK_CLASS = "flex flex-col lg:fixed lg:right-0 lg:bottom-0 lg:w-(--task-aside)";

/** The dock's composer row, behind a hairline. */
export const TUTOR_DOCK_BAR_CLASS =
  "border-border bg-background border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))]";

/** The conversation docked over the aside's content from `lg`, above the dock. */
export const DOCKED_CONVERSATION_CLASS =
  "bg-background border-border hidden lg:fixed lg:top-0 lg:right-0 lg:bottom-(--task-aside-bottom) lg:z-40 lg:flex lg:w-(--task-aside) lg:flex-col lg:border-l";

/**
 * The task's aside keeps its content above the dock (`--task-aside-bottom` on the task's root),
 * whatever the dock holds: suggested questions, a composer grown to a few lines, an error under it.
 */
export function useAsideBottom(dockRef: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    const dock = dockRef.current;
    const root = dock?.closest<HTMLElement>("[data-aside]");

    if (!dock || !root) {
      return;
    }

    const update = () => root.style.setProperty("--task-aside-bottom", `${dock.offsetHeight}px`);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(dock);

    return () => {
      observer.disconnect();
      root.style.removeProperty("--task-aside-bottom");
    };
  }, [dockRef]);
}
