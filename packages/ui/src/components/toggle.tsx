"use client";

import { Toggle as TogglePrimitive } from "@base-ui/react/toggle";
import { cn } from "@zoonk/ui/lib/utils";
import { type VariantProps, cva } from "class-variance-authority";

const toggleVariants = cva(
  "group/toggle hit-area hover:bg-muted/60 hover:text-foreground focus-visible:border-ring focus-visible:ring-ring/50 aria-pressed:bg-selected-tint aria-pressed:text-foreground aria-pressed:hover:bg-selected-tint aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 relative inline-flex items-center justify-center gap-1 rounded-lg text-sm font-medium whitespace-nowrap transition-colors outline-none focus-visible:ring-[3px] disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 forced-colors:aria-pressed:bg-[Highlight] forced-colors:aria-pressed:text-[HighlightText] [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    defaultVariants: { size: "default", variant: "default" },
    variants: {
      size: {
        default: "h-9 min-w-9 rounded-lg px-2.5",
        lg: "h-10 min-w-10 px-2.5",
        sm: "h-8 min-w-8 px-3",
      },
      variant: {
        default: "bg-transparent",
        // Off, a line and a quiet label; on, the pick's fill takes the line's place.
        outline:
          "border-input text-muted-foreground contrast-more:aria-pressed:border-input border bg-transparent aria-pressed:border-transparent",
      },
    },
  },
);

/** Base UI's Toggle has no `focusableWhenDisabled`, so it's added here to match Button. */
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

export { Toggle };
