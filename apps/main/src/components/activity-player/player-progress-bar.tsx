import { ProgressIndicator, ProgressRoot, ProgressTrack } from "@zoonk/ui/components/progress";
import { cn } from "@zoonk/ui/lib/utils";

export function PlayerProgressBar({
  className,
  value,
  ...props
}: Omit<React.ComponentProps<"div">, "value"> & { value: number }) {
  return (
    <ProgressRoot
      aria-label="Activity progress"
      className={cn("gap-0", className)}
      data-slot="player-progress-bar"
      value={value}
      {...props}
    >
      <ProgressTrack className="h-0.5 rounded-none">
        <ProgressIndicator />
      </ProgressTrack>
    </ProgressRoot>
  );
}
