import { cn } from "@zoonk/ui/lib/utils";

const WIDTH = 100;
const HEIGHT = 32;
const PERCENT = 100;
/** Room for the line's own thickness, so a peak or a zero isn't cut by the box. */
const INSET = 2;

type Point = { x: number; y: number };

function toPoints(values: readonly number[]): Point[] {
  const top = Math.max(...values, 0);
  const step = values.length > 1 ? WIDTH / (values.length - 1) : 0;

  return values.map((value, index) => ({
    x: index * step,
    y: top > 0 ? INSET + (1 - value / top) * (HEIGHT - INSET * 2) : HEIGHT - INSET,
  }));
}

function line(points: readonly Point[]): string {
  return points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x},${point.y}`).join(" ");
}

function area(points: readonly Point[]): string {
  const first = points.at(0);
  const last = points.at(-1);

  return first && last ? `${line(points)} L${last.x},${HEIGHT} L${first.x},${HEIGHT} Z` : "";
}

/**
 * A number's recent shape, from zero: the period the number counts in the text color, what came
 * before it (`before` points) in gray, and a dot on the newest value. It has no axis: its tile says
 * the value and links to the chart that has one.
 */
export function Sparkline({
  before = 0,
  className,
  label,
  values,
}: {
  /** How many leading values belong to the period before the one the number counts. */
  before?: number;
  className?: string;
  label: string;
  values: readonly number[];
}) {
  const points = toPoints(values);
  const last = points.at(-1);

  if (!last || points.length < 2) {
    return null;
  }

  const earlier = points.slice(0, before + 1);
  const current = points.slice(before);

  return (
    <span
      aria-label={label}
      className={cn("relative block h-8", className)}
      data-slot="sparkline"
      role="img"
    >
      <svg
        aria-hidden="true"
        className="absolute inset-0 size-full overflow-visible"
        preserveAspectRatio="none"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
      >
        <path className="fill-foreground/6" d={area(current)} />
        {earlier.length > 1 ? (
          <path
            className="stroke-foreground/25 fill-none"
            d={line(earlier)}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
          />
        ) : null}
        <path
          className="stroke-foreground fill-none"
          d={line(current)}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      <span
        className="bg-foreground ring-background absolute -right-0.75 size-1.5 -translate-y-1/2 rounded-full ring-2"
        style={{ top: `${(last.y / HEIGHT) * PERCENT}%` }}
      />
    </span>
  );
}
