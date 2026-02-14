import { cn } from "@zoonk/ui/lib/utils";
import { type PlayerPhase } from "./player-reducer";

export function PlayerStage({
  className,
  phase,
  ...props
}: React.ComponentProps<"section"> & {
  phase: PlayerPhase;
}) {
  return (
    <section
      className={cn(
        "flex flex-1 flex-col items-center justify-center overflow-y-auto p-4",
        "data-[phase=feedback]:px-6 data-[phase=feedback]:sm:px-8",
        className,
      )}
      data-phase={phase}
      data-slot="player-stage"
      {...props}
    />
  );
}
