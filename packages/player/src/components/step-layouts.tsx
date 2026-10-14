import { cn } from "@zoonk/ui/lib/utils";

/**
 * The player's one column, the same as every task's (`TaskBody`, the header's segments and the
 * action bar): one width and one left edge for the question, its result and the main action.
 */
export function PlayerContentFrame({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("max-w-column mx-auto w-full px-4", className)}
      data-slot="player-content-frame"
      {...props}
    />
  );
}

/**
 * Every interactive screen in the player's column, starting at the top on every size, so a longer
 * question never moves what's above it and the answers sit where the last screen's did.
 */
export function InteractiveStepLayout({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <PlayerContentFrame
      className={cn("flex flex-col gap-6 pt-4 pb-6", className)}
      data-slot="interactive-step-layout"
      {...props}
    />
  );
}
