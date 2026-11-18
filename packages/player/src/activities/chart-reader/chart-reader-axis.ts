import { type NumericDomain, niceTicks } from "@zoonk/utils/plot-scale";

const HOURS_PER_DAY = 24;
const MINUTES_PER_HOUR = 60;

// Published intraday charts carry the axis kind in their label.
export function isHourAxis({ domain, label }: { domain: NumericDomain; label: string }): boolean {
  return (
    (label === "Hour of the day" || label === "Hora do dia") &&
    domain[0] >= 0 &&
    domain[1] <= HOURS_PER_DAY
  );
}

export function chartReaderTicks({
  domain,
  label,
}: {
  domain: NumericDomain;
  label: string;
}): number[] {
  if (!isHourAxis({ domain, label })) {
    return niceTicks(domain, 3);
  }

  const first = Math.ceil(domain[0]);
  const last = Math.floor(domain[1]);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

export function clockTime(value: number): string {
  const minutes = Math.round(value * MINUTES_PER_HOUR);
  const hour = Math.floor(minutes / MINUTES_PER_HOUR) % HOURS_PER_DAY;
  return [hour, minutes % MINUTES_PER_HOUR].map((part) => String(part).padStart(2, "0")).join(":");
}
