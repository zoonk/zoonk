import { cn } from "@zoonk/ui/lib/utils";

export type SpotState = "active" | "correct" | "empty" | "filled" | "incorrect";

export function SpotNumber({
  className,
  number,
  state,
}: {
  className?: string;
  number: number;
  state: SpotState;
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums motion-safe:transition-[background-color,box-shadow,scale]",
        state === "empty" && "bg-background text-foreground ring-foreground/70 ring-2 ring-inset",
        state === "filled" && "bg-foreground text-background",
        state === "active" && "bg-viz-accent text-background ring-viz-accent/30 scale-110 ring-4",
        state === "correct" && "bg-success-text text-background",
        state === "incorrect" && "bg-destructive-text text-white",
        className,
      )}
    >
      {number}
    </span>
  );
}
