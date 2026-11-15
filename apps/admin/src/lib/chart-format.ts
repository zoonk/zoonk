import { formatUsd } from "@/lib/ai-format";
import { formatDuration } from "@/lib/format-duration";

export type ChartValueFormat = "duration" | "number" | "percent" | "usd";

export function formatChartValue({
  format,
  value,
}: {
  format: ChartValueFormat;
  value: number | null;
}): string {
  if (value === null) {
    return "No data";
  }

  if (format === "duration") {
    return formatDuration(value);
  }

  if (format === "percent") {
    return `${value.toFixed(1)}%`;
  }

  if (format === "usd") {
    return formatUsd(value);
  }

  return value.toLocaleString("en", { maximumFractionDigits: 1 });
}

export function formatChartTick({
  format,
  value,
}: {
  format: ChartValueFormat;
  value: number;
}): string {
  if (value === 0) {
    return "0";
  }

  if (format === "duration") {
    return formatDuration(value);
  }

  if (format === "percent") {
    return `${Math.round(value)}%`;
  }

  if (format === "usd") {
    return `$${Math.round(value).toLocaleString("en")}`;
  }

  return Math.round(value).toLocaleString("en");
}
