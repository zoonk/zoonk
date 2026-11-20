import { cn } from "@zoonk/ui/lib/utils";

const PERCENT = 100;

/** Shares are 0 to 1. */
export function ProgressCell({
  className,
  known = 0,
  planned = false,
  studied = 0,
}: {
  className?: string;
  known?: number;
  planned?: boolean;
  studied?: number;
}) {
  return (
    <span
      className={cn(
        "rounded-meter flex h-1.5 min-w-0 flex-1 overflow-hidden",
        planned ? "ring-success ring-1 ring-inset" : "bg-surface-3",
        className,
      )}
      data-slot="progress-cell"
    >
      {studied > 0 && (
        <span className="bg-success h-full" style={{ width: `${studied * PERCENT}%` }} />
      )}
      {known > 0 && (
        <span className="bg-muted-foreground/70 h-full" style={{ width: `${known * PERCENT}%` }} />
      )}
    </span>
  );
}
