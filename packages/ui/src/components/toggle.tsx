"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

const toggleVariants = cva(
  "group/toggle hit-area hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-pressed:bg-muted aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 relative inline-flex items-center justify-center gap-1 rounded-4xl text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: { size: "default", variant: "default" },
    variants: {
      size: {
        default: "h-9 min-w-9 rounded-[min(var(--radius-2xl),12px)] px-2.5",
        lg: "h-10 min-w-10 px-2.5",
        sm: "h-8 min-w-8 px-3",
      },
      variant: {
        default: "bg-transparent",
        outline: "border-input hover:bg-muted border bg-transparent",
      },
    },
  },
);

/**
 * `focusableWhenDisabled` works as it does on Button, which Base UI's Toggle doesn't offer: a toggle
 * that waits on a save stays in the tab order as `aria-disabled` and ignores presses, so keyboard
 * focus isn't dropped to the page.
 */
function Toggle({
  className,
  disabled,
  focusableWhenDisabled = false,
  onPressedChange,
  variant = "default",
  size = "default",
  ...props
}: TogglePrimitive.Props &
  VariantProps<typeof toggleVariants> & { focusableWhenDisabled?: boolean }) {
  const keepsFocus = Boolean(disabled) && focusableWhenDisabled;

  return (
    <TogglePrimitive
      aria-disabled={keepsFocus || undefined}
      className={cn(toggleVariants({ className, size, variant }))}
      data-slot="toggle"
      disabled={keepsFocus ? false : disabled}
      onPressedChange={(pressed, details) =>
        keepsFocus ? details.cancel() : onPressedChange?.(pressed, details)
      }
      {...props}
    />
  );
}

export { Toggle, toggleVariants };
