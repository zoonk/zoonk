import { cn } from "@zoonk/ui/lib/utils";

const PERCENT = 100;

function edgeAlign(index: number, count: number): string {
  if (index === 0) {
    return "translate-x-0";
  }

  return index === count - 1 ? "-translate-x-full" : "-translate-x-1/2";
}

export function SampleSizeStops({ index, labels }: { index: number; labels: readonly string[] }) {
  const last = labels.length - 1;

  return (
    <div aria-hidden="true" className="text-muted-foreground relative h-4 text-xs tabular-nums">
      {labels.map((label, position) => (
        <span
          className={cn(
            "absolute top-0 whitespace-nowrap",
            edgeAlign(position, labels.length),
            position === index && "text-foreground font-medium",
          )}
          key={label}
          style={{ left: `${(position / Math.max(last, 1)) * PERCENT}%` }}
        >
          {label}
        </span>
      ))}
    </div>
  );
}
