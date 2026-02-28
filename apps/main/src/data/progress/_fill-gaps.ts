import { DAILY_DECAY, MIN_ENERGY } from "@zoonk/utils/constants";

type DataPoint = { date: Date; energy: number };

function buildDateEnergyMap(dataPoints: DataPoint[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const point of dataPoints) {
    map.set(point.date.toISOString().slice(0, 10), point.energy);
  }
  return map;
}

function getDateBounds(sorted: DataPoint[]): { firstDate: Date; lastDate: Date } | null {
  const first = sorted[0];
  const last = sorted.at(-1);
  if (!first || !last) {
    return null;
  }
  return { firstDate: first.date, lastDate: last.date };
}

function getDayCount(firstDate: Date, lastDate: Date): number {
  const utcFirst = Date.UTC(
    firstDate.getUTCFullYear(),
    firstDate.getUTCMonth(),
    firstDate.getUTCDate(),
  );
  const utcLast = Date.UTC(
    lastDate.getUTCFullYear(),
    lastDate.getUTCMonth(),
    lastDate.getUTCDate(),
  );
  return Math.round((utcLast - utcFirst) / (1000 * 60 * 60 * 24));
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

function fillDateRange(firstDate: Date, lastDate: Date, dataMap: Map<string, number>): DataPoint[] {
  const days = getDayCount(firstDate, lastDate);
  const result: DataPoint[] = [];
  let previousEnergy: number | null = null;

  for (let i = 0; i <= days; i += 1) {
    const date = addDays(firstDate, i);
    const key = date.toISOString().slice(0, 10);
    const existingEnergy = dataMap.get(key);

    if (existingEnergy !== undefined) {
      result.push({ date, energy: existingEnergy });
      previousEnergy = existingEnergy;
    } else if (previousEnergy !== null) {
      const decayedEnergy = Math.max(MIN_ENERGY, previousEnergy - DAILY_DECAY);
      result.push({ date, energy: decayedEnergy });
      previousEnergy = decayedEnergy;
    }
  }

  return result;
}

export function fillGapsWithDecay(dataPoints: DataPoint[]): DataPoint[] {
  if (dataPoints.length === 0) {
    return [];
  }

  const sorted = [...dataPoints].toSorted((a, b) => a.date.getTime() - b.date.getTime());
  const bounds = getDateBounds(sorted);
  if (!bounds) {
    return [];
  }

  const dataMap = buildDateEnergyMap(sorted);
  return fillDateRange(bounds.firstDate, bounds.lastDate, dataMap);
}
