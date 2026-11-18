"use client";

import { cn } from "@zoonk/ui/lib/utils";
import { TaskAside, getTaskAsideRootProps } from "../_components/task-layout";
import { type TaskFrameAside } from "../shell/task-frame";

export function SessionFrame({
  aside,
  children,
}: {
  aside: TaskFrameAside;
  children: React.ReactNode;
}) {
  const root = getTaskAsideRootProps({ width: aside.width });

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
