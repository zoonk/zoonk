"use client";

import { useIsMounted } from "@zoonk/ui/hooks/is-mounted";
import { useLayoutEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Set on the document while a task covers the app's frame. A frame leaves the screen with
 * `in-data-task-layer:hidden`.
 */
const TASK_LAYER_ATTRIBUTE = "data-task-layer";

/**
 * A full-screen task opened from a page of the app's frame without a route of its own: the frame
 * leaves the screen and the page under the task stays mounted with its state.
 */
export function TaskLayer({ children }: { children: React.ReactNode }) {
  const mounted = useIsMounted();

  useLayoutEffect(() => {
    document.documentElement.setAttribute(TASK_LAYER_ATTRIBUTE, "");
    return () => document.documentElement.removeAttribute(TASK_LAYER_ATTRIBUTE);
  }, []);

  return mounted ? createPortal(children, document.body) : null;
}
