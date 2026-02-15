import { cn } from "@zoonk/ui/lib/utils";
import { type PlayerPhase } from "./player-reducer";

export function PlayerStage({
  className,
  isStatic,
  phase,
  ...props
}: React.ComponentProps<"section"> & {
  isStatic?: boolean;
  phase: PlayerPhase;
}) {
  return (
    <section
      className={cn(
        "flex flex-1 flex-col items-center overflow-y-auto",
        isStatic ? "p-0" : "justify-center p-4",
        "data-[phase=feedback]:px-6 data-[phase=feedback]:sm:px-8",
        className,
      )}
      data-phase={phase}
      data-slot="player-stage"
      {...props}
    />
  );
}
