import { cn } from "@zoonk/ui/lib/utils";

export function ProgressDots({
  current,
  total,
  className,
}: {
  current: number;
  total: number;
  className?: string;
}) {
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
