"use client";

import { type RefObject, useLayoutEffect, useRef } from "react";

/**
 * Keeps the height of what sits at a task's foot (the action bar, the buddy's dock) in `variable`
 * on the task's root, so the aside and what joins it end above the taller of them, whatever they
 * hold: a line over the actions, a call's typed reply, a composer grown to a few lines. A task
 * without an aside measures nothing.
 */
export function useTaskFootHeight(
  ref: RefObject<HTMLElement | null>,
  variable: "--task-action-bar" | "--task-dock",
) {
  useLayoutEffect(() => {
    const element = ref.current;
    const root = element?.closest<HTMLElement>("[data-aside]");

    if (!element || !root) {
      return;
    }

    const update = () => root.style.setProperty(variable, `${element.offsetHeight}px`);
    update();

    const observer = new ResizeObserver(update);
    observer.observe(element);

    return () => {
      observer.disconnect();
      root.style.removeProperty(variable);
    };
  }, [ref, variable]);
}

/** The action bar's own element (`TaskActionBar`), which keeps its height on the task's root. */
export function TaskActionBarFrame(props: Omit<React.ComponentProps<"div">, "ref">) {
  const ref = useRef<HTMLDivElement>(null);
  useTaskFootHeight(ref, "--task-action-bar");

  return <div ref={ref} {...props} />;
}
