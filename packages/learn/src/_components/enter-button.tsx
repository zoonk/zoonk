"use client";

import { Button } from "@zoonk/ui/components/button";
import { ShortcutKbd } from "@zoonk/ui/components/kbd";
import { cn } from "@zoonk/ui/lib/utils";
import { usePrimaryVariant } from "../_utils/fun-primary";
import { useExperienceMode } from "../mode-provider";

/**
 * A step's main action with its Enter hint, the lime pill in Fun. The caller binds Enter, since
 * when it may press the button depends on the step.
 */
export function EnterButton({
  children,
  className,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "size" | "variant">) {
  const mode = useExperienceMode();
  const variant = usePrimaryVariant();

  return (
    <Button
      aria-keyshortcuts="Enter"
      className={cn("h-12 w-full rounded-full text-base", className)}
      size="lg"
      variant={variant}
      {...props}
    >
      {children}
      <ShortcutKbd tone={mode === "fun" ? "default" : "inverse"}>Enter</ShortcutKbd>
    </Button>
  );
}
