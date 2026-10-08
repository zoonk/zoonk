"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";

/**
 * A step's main action with its Enter hint right after its label, both centered. The caller binds
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
      className={cn(
        "h-12 w-full rounded-full text-base lg:pointer-fine:has-data-[slot=shortcut-kbd]:justify-center",
        className,
      )}
      size="lg"
      {...props}
    >
      {children}
      <ShortcutKbd tone="inverse">Enter</ShortcutKbd>
    </Button>
  );
}
