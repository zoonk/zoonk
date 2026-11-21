import { cn } from "@zoonk/ui/lib/utils";
import { type LinearScale } from "@zoonk/utils/plot-scale";
import { useExtracted } from "next-intl";
import { SURFACE_CLASS } from "../_components/surface";
import { LABEL_GAP } from "./_utils/chart-layout";
import { type ChartSize, LABEL_FONT_SIZE } from "./_utils/use-text-scale";

export function ChartFigure({
  children,
  className,
  slot,
  source,
  title,
}: {
  children: React.ReactNode;
  className?: string;
  slot: string;
  source: string | null;
  title: string;
}) {
  const t = useExtracted();

  return (
    <figure
      className={cn(SURFACE_CLASS, "flex w-full flex-col gap-3 p-4", className)}
      data-slot={slot}
    >
      <figcaption className="text-foreground text-sm font-semibold text-balance">
        {title}
      </figcaption>

      {children}

      {source && (
        <p className="text-muted-foreground text-xs">{t("Source: {source}", { source })}</p>
      )}
    </figure>
  );
}

export function ChartDrawing({
  boxWidth,
  children,
  height,
  ref,
  scale,
  width,
}: ChartSize & { children: React.ReactNode; height: number }) {
  return (
    <div className="w-full text-xs" ref={ref}>
      <svg
        aria-hidden="true"
        className="block overflow-visible tabular-nums select-none"
        fontSize={LABEL_FONT_SIZE}
        height={height * scale}
        viewBox={`0 0 ${width} ${height}`}
        width={boxWidth}
      >
        {children}
      </svg>
    </div>
  );
}

export function ValueGrid({
  left,
  right,
  ticks,
  y,
}: {
  left: number;
  right: number;
  ticks: { label: string; value: number }[];
  y: LinearScale;
}) {
  return ticks.map((tick) => {
    const at = y.toPixel(tick.value);

    return (
      <g key={tick.value}>
        <line className="stroke-viz-grid" x1={left} x2={right} y1={at} y2={at} />
        <text
          className="fill-muted-foreground"
          dominantBaseline="middle"
          textAnchor="end"
          x={left - LABEL_GAP}
          y={at}
        >
          {tick.label}
        </text>
      </g>
    );
  });
}

/**
 * Inside a challenge's conversation log, a screen reader announces a new chart by its title alone;
 * its data waits until the learner moves through it.
 */
export function ScreenReaderData({ children }: { children: React.ReactNode }) {
  return (
    <div aria-live="off" className="sr-only">
      {children}
    </div>
  );
}
