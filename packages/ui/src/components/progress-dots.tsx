import { cn } from "@zoonk/ui/lib/utils";

type ProgressDotsProps = {
  /**
   * Current step index (0-based)
   */
  current: number;
  /**
   * Total number of steps
   */
  total: number;
  /**
   * Optional className for the container
   */
  className?: string;
};

function ProgressDots({ current, total, className }: ProgressDotsProps) {
  return (
    <div
      aria-label={`Step ${current + 1} of ${total}`}
      aria-valuemax={total}
      aria-valuemin={1}
      aria-valuenow={current + 1}
      className={cn("flex gap-1.5", className)}
      role="progressbar"
    >
      {Array.from({ length: total }).map((_, index) => (
        <div
          aria-hidden="true"
          className={cn(
            "size-2 rounded-full transition-colors",
            index <= current
              ? "bg-foreground"
              : "bg-muted-foreground/30 dark:bg-muted-foreground/20",
          )}
          key={index}
        />
      ))}
    </div>
  );
}

export { ProgressDots };
