import { cn } from "@zoonk/ui/lib/utils";
import { type PlayerPhase } from "./player-reducer";

export function PlayerStage({
  className,
  feedback,
  phase,
  ...props
}: React.ComponentProps<"section"> & {
  feedback?: "correct" | "incorrect" | "challenge";
  phase: PlayerPhase;
}) {
  return (
    <section
      className={cn(
        "flex flex-1 flex-col items-center overflow-y-auto transition-colors duration-300",
        "data-[phase=feedback]:justify-start data-[phase=feedback]:px-6 data-[phase=feedback]:pt-16 data-[phase=feedback]:sm:px-8 data-[phase=feedback]:sm:pt-24",
        "data-[phase=playing]:justify-center data-[phase=playing]:p-4",
        "data-[phase=completed]:justify-center data-[phase=completed]:p-4",
        "data-[feedback=correct]:bg-success/5",
        "data-[feedback=incorrect]:bg-destructive/5",
        className,
      )}
      data-feedback={feedback}
      data-phase={phase}
      data-slot="player-stage"
      {...props}
    />
  );
}
