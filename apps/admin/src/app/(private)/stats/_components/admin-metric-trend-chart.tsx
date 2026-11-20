import { AdminBarChart } from "@/components/admin-bar-chart";
import { type ChartValueFormat, formatChartValue } from "@/lib/chart-format";
import { type MetricTrendDataPoint } from "../_utils/complete-metric-trend";

/** Only real points: missing buckets never become zeroes for rates or averages. */
function getTrendExtremes(dataPoints: MetricTrendDataPoint[]) {
  const validPoints = dataPoints.filter(
    (dataPoint): dataPoint is MetricTrendDataPoint & { value: number } => dataPoint.value !== null,
  );

  if (validPoints.length === 0) {
    return;
  }

  const low = validPoints.reduce((lowest, point) => (point.value < lowest.value ? point : lowest));

  return {
    hasUniqueLow: validPoints.filter((point) => point.value === low.value).length === 1,
    low,
    observedPointCount: validPoints.length,
    peak: validPoints.reduce((highest, point) => (point.value > highest.value ? point : highest)),
  };
}

function getFlatTrendLabel({
  hasCompleteTrend,
  observedPointCount,
}: {
  hasCompleteTrend: boolean;
  observedPointCount: number;
}): string {
  if (observedPointCount === 1) {
    return "Only bar with data";
  }

  return hasCompleteTrend ? "Every bar" : "Every bar with data";
}

export function AdminMetricTrendChart({
  dataPoints,
  label,
  valueFormat,
}: {
  dataPoints: MetricTrendDataPoint[];
  label: string;
  valueFormat: Exclude<ChartValueFormat, "usd">;
}) {
  const extremes = getTrendExtremes(dataPoints);

  if (
    !extremes ||
    (valueFormat === "number" && extremes.low.value === 0 && extremes.peak.value === 0)
  ) {
    return (
      <figure
        aria-label={`${label} trend`}
        className="text-muted-foreground flex min-h-80 flex-1 items-center justify-center text-sm"
      >
        There is no data in this period.
      </figure>
    );
  }

  const isFlatTrend = extremes.low.value === extremes.peak.value;
  const hasCompleteTrend = dataPoints.every((dataPoint) => dataPoint.value !== null);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-5">
      <p className="flex flex-wrap gap-x-10 gap-y-2 text-sm">
        {isFlatTrend ? (
          <TrendAnnotation
            format={valueFormat}
            label={getFlatTrendLabel({
              hasCompleteTrend,
              observedPointCount: extremes.observedPointCount,
            })}
            point={extremes.peak}
            showDate={false}
          />
        ) : (
          <>
            <TrendAnnotation format={valueFormat} label="Peak" point={extremes.peak} />
            <TrendAnnotation
              format={valueFormat}
              label="Low"
              point={extremes.low}
              showDate={extremes.hasUniqueLow}
            />
          </>
        )}
      </p>

      <AdminBarChart
        className="h-88 w-full sm:h-120 lg:h-[min(54vh,34rem)]"
        format={valueFormat}
        label={`${label} trend`}
        points={dataPoints}
      />
    </div>
  );
}

function TrendAnnotation({
  format,
  label,
  point,
  showDate = true,
}: {
  format: ChartValueFormat;
  label: string;
  point: MetricTrendDataPoint & { value: number };
  showDate?: boolean;
}) {
  return (
    <span className="flex items-baseline gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">
        {formatChartValue({ format, value: point.value })}
      </span>
      {showDate ? <span className="text-muted-foreground">{point.label}</span> : null}
    </span>
  );
}
