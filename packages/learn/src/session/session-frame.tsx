"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { TaskAside, getTaskAsideRootProps } from "../_components/task-layout";
import { type TaskFrameAside } from "../shell/task-frame";

/**
 * A session screen's root (a block of questions, the moment between blocks, the next stop): its
 * header, column and action bar, and from `lg` the task's aside beside them with what helps
 * (`aside`: the day's queue, or the text a question is on), as every task's frame has. The
 * session page draws the `main` around it.
 */
export function SessionFrame({
  aside,
  children,
}: {
  aside: TaskFrameAside;
  children: React.ReactNode;
}) {
  const root = getTaskAsideRootProps({ footer: Boolean(aside.footer), width: aside.width });

  return (
    <div
      className={cn("flex flex-1 flex-col", root.className)}
      data-aside={root["data-aside"]}
      data-slot="session-frame"
    >
      {children}

      <TaskAside footer={aside.footer} label={aside.label} meta={aside.meta} title={aside.title}>
        {aside.children}
      </TaskAside>
    </div>
  );
}
