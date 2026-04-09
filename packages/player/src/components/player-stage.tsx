import { cn } from "@zoonk/ui/lib/utils";
import { type PlayerPhase } from "../player-reducer";

export function PlayerStage({
  className,
  isStatic,
  phase,
  scene,
  ...props
}: React.ComponentProps<"section"> & {
  isStatic?: boolean;
  phase: PlayerPhase;
  scene?: string;
}) {
  return (
    <section
      className={cn(
        "flex min-h-0 min-w-0 flex-1 flex-col items-center",
        isStatic ? "overflow-hidden" : "overflow-y-auto",
        className,
      )}
      data-phase={phase}
      data-scene={scene}
      data-slot="player-stage"
      {...props}
    />
  );
}
