import { cn } from "@zoonk/ui/lib/utils";

/**
 * Centers player content inside one shared width contract.
 *
 * The player used to repeat `max-w-*` and padding classes across static
 * screens, feedback screens, and the mobile bottom bar. This frame is the
 * single source of truth for every centered screen that should align with the
 * primary action button.
 */
export function PlayerContentFrame({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("mx-auto w-full max-w-2xl px-4", className)}
      data-slot="player-content-frame"
      {...props}
    />
  );
}

/**
 * Wraps every centered interactive screen in the shared player frame so answer
 * content and primary actions always use the same width.
 */
export function InteractiveStepLayout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <PlayerContentFrame
      className={cn("my-auto flex flex-col gap-4 py-4 sm:gap-6 sm:py-6", className)}
      data-slot="interactive-step-layout"
      {...props}
    />
  );
}
