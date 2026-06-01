import { cn } from "@zoonk/ui/lib/utils";
import { type PlayerPhase } from "../player-reducer";

/**
 * Chooses the stage scroll/alignment mode from the screen layout flags.
 *
 * Hero screens need the child to own the whole stage at every breakpoint.
 * Static read screens keep overflow locked for swipe navigation, while
 * interactive screens own normal vertical scrolling.
 */
function getStageLayoutClass({
  isFullBleed,
  isStatic,
}: {
  isFullBleed?: boolean;
  isStatic?: boolean;
}) {
  if (isFullBleed) {
    return "items-stretch overflow-hidden";
  }

  if (isStatic) {
    return "items-center overflow-hidden";
  }

  return "items-center overflow-y-auto";
}

/**
 * Owns the scroll and alignment boundary for the active player screen.
 *
 * Most steps stay centered so readable content does not stretch too wide, but
 * mobile hero screens need a full-bleed stage where the child can occupy the
 * entire viewport without inheriting centered spacing.
 */
export function PlayerStage({
  className,
  isFullBleed,
  isStatic,
  phase,
  scene,
  ...props
}: React.ComponentProps<"section"> & {
  isFullBleed?: boolean;
  isStatic?: boolean;
  phase: PlayerPhase;
  scene?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col",
        getStageLayoutClass({ isFullBleed, isStatic }),
        className,
      )}
      data-phase={phase}
      data-scene={scene}
      data-slot="player-stage"
      {...props}
    />
  );
}
