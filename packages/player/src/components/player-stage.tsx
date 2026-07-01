import { cn } from "@zoonk/ui/lib/utils";
import { type PlayerPhase } from "../player-reducer";

/**
 * Chooses the stage scroll/alignment mode from the screen layout flags.
 *
 * Static read screens keep overflow locked for swipe navigation, while
 * interactive screens own normal vertical scrolling.
 */
function getStageLayoutClass({ isStatic }: { isStatic?: boolean }) {
  if (isStatic) {
    return "items-center overflow-hidden";
  }

  return "items-center overflow-y-auto";
}

/**
 * Owns the scroll and alignment boundary for the active player screen.
 *
 * Most steps stay centered so readable content does not stretch too wide, but
 * static read screens keep their own swipe/navigation overflow behavior.
 */
export function PlayerStage({
  className,
  isStatic,
  phase,
  scene,
  ...props
}: React.ComponentProps<"section"> & { isStatic?: boolean; phase: PlayerPhase; scene?: string }) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        getStageLayoutClass({ isStatic }),
        className,
      )}
      data-phase={phase}
      data-scene={scene}
      data-slot="player-stage"
      {...props}
    />
  );
}
