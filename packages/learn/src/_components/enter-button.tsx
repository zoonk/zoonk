"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { shortcutKeys } from "@zoonk/ui/lib/shortcuts";
import { cn } from "@zoonk/ui/lib/utils";
import { TASK_MAIN_ACTION_CLASS } from "./task-layout";

/**
 * A task's main action. It shows the ⏎ hint only: the caller binds Enter, since when it may press
 * depends on the step, and passes `shortcut={false}` where Enter doesn't press it.
 */
export function EnterButton({
  children,
  className,
  shortcut = true,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "variant"> & { shortcut?: boolean }) {
  return (
    <Button
      aria-keyshortcuts={shortcut ? shortcutKeys("main") : undefined}
      className={cn(TASK_MAIN_ACTION_CLASS, className)}
      focusableWhenDisabled
      size="xl"
      {...props}
    >
      {children}
      {shortcut && <ShortcutKbd shortcut="main" tone="inverse" />}
    </Button>
  );
}
