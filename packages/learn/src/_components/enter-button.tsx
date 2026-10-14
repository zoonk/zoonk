"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { TASK_MAIN_ACTION_CLASS } from "./task-layout";

/**
 * A step's main action (44px, the screen's main button) with its ⏎ hint right after its label,
 * both centered, sized like every task's main action in its `TaskActions` row. The caller binds
 * Enter, since when it may press the button depends on the step.
 */
export function EnterButton({
  children,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "variant">) {
  return (
    <Button
      aria-keyshortcuts="Enter"
      className={cn(TASK_MAIN_ACTION_CLASS, className)}
      size="xl"
      {...props}
    >
      {children}
      <ShortcutKbd tone="inverse">⏎</ShortcutKbd>
    </Button>
  );
}
