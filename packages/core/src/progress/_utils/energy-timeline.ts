import { MS_PER_DAY } from "@zoonk/utils/date";
import { DAILY_DECAY, type EnergyCursor, MIN_ENERGY, projectCurrentEnergy } from "../energy";

export type EnergyTimelineProjection = {
  averageEnergy: number | null;
  visibleDays: EnergyCursor[];
};

type EnergyTimelineSummary = { dayCount: number; energySum: number };
type EnergyTimelineSegment = { cursor: EnergyCursor; endDate: Date };

/** Dates are UTC-midnight local-day labels, so timestamp distance counts calendar days exactly. */
function getDateDifference({ endDate, startDate }: { endDate: Date; startDate: Date }): number {
  return Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);
}

function sortEnergyCursors(cursors: EnergyCursor[]): EnergyCursor[] {
  return cursors.toSorted((first, second) => first.date.getTime() - second.date.getTime());
}

/** The next stored cursor is authoritative; gap projection must not include its date. */
function getMissingDayCount({ cursor, endDate }: { cursor: EnergyCursor; endDate: Date }): number {
  return Math.max(0, getDateDifference({ endDate, startDate: cursor.date }) - 1);
}

function getEnergyAfterDays({
  cursor,
  dayOffset,
}: {
  cursor: EnergyCursor;
  dayOffset: number;
}): number {
  return Math.max(MIN_ENERGY, cursor.energyAtEnd - dayOffset * DAILY_DECAY);
}

function buildEnergyTimelineSegments({
  cursors,
  effectiveTargetDate,
}: {
  cursors: EnergyCursor[];
  effectiveTargetDate: Date;
}): EnergyTimelineSegment[] {
  return cursors.map((cursor, cursorIndex) => ({
    cursor,
    endDate: cursors[cursorIndex + 1]?.date ?? effectiveTargetDate,
  }));
}

function summarizeMissingDays({
  cursor,
  missingDayCount,
}: {
  cursor: EnergyCursor;
  missingDayCount: number;
}): EnergyTimelineSummary {
  const positiveDayCount = Math.min(
    missingDayCount,
    Math.max(0, Math.ceil(cursor.energyAtEnd / DAILY_DECAY) - 1),
  );

  const energySum =
    positiveDayCount * cursor.energyAtEnd -
    (DAILY_DECAY * positiveDayCount * (positiveDayCount + 1)) / 2;

  return { dayCount: missingDayCount, energySum };
}

function addEnergySegmentToSummary(
  summary: EnergyTimelineSummary,
  segment: EnergyTimelineSegment,
): EnergyTimelineSummary {
  const missingDays = summarizeMissingDays({
    cursor: segment.cursor,
    missingDayCount: getMissingDayCount(segment),
  });

  return {
    dayCount: summary.dayCount + missingDays.dayCount + 1,
    energySum: summary.energySum + missingDays.energySum + segment.cursor.energyAtEnd,
  };
}

function summarizeEnergyTimeline(segments: EnergyTimelineSegment[]): EnergyTimelineSummary {
  return segments.reduce((summary, segment) => addEnergySegmentToSummary(summary, segment), {
    dayCount: 0,
    energySum: 0,
  });
}

function buildVisibleMissingDays({
  cursor,
  endDate,
  visibleEndDate,
  visibleStartDate,
}: {
  cursor: EnergyCursor;
  endDate: Date;
  visibleEndDate: Date;
  visibleStartDate: Date;
}): EnergyCursor[] {
  const boundedEndDate = endDate < visibleEndDate ? endDate : visibleEndDate;

  const firstDayOffset = Math.max(
    1,
    getDateDifference({ endDate: visibleStartDate, startDate: cursor.date }),
  );

  const missingDayCount = Math.max(
    0,
    getDateDifference({ endDate: boundedEndDate, startDate: cursor.date }) - firstDayOffset,
  );

  return Array.from({ length: missingDayCount }, (_, dayIndex) => {
    const dayOffset = firstDayOffset + dayIndex;

    return {
      date: new Date(cursor.date.getTime() + dayOffset * MS_PER_DAY),
      energyAtEnd: getEnergyAfterDays({ cursor, dayOffset }),
    };
  });
}

function buildVisibleSegment({
  cursor,
  endDate,
  visibleEndDate,
  visibleStartDate,
}: {
  cursor: EnergyCursor;
  endDate: Date;
  visibleEndDate: Date;
  visibleStartDate: Date;
}): EnergyCursor[] {
  const cursorIsVisible = cursor.date >= visibleStartDate && cursor.date <= visibleEndDate;
  const cursorDay = cursorIsVisible ? [{ ...cursor }] : [];

  const missingDays = buildVisibleMissingDays({
    cursor,
    endDate,
    visibleEndDate,
    visibleStartDate,
  });

  return [...cursorDay, ...missingDays];
}

function buildVisibleEnergyDays({
  segments,
  visibleEndDate,
  visibleStartDate,
}: {
  segments: EnergyTimelineSegment[];
  visibleEndDate: Date;
  visibleStartDate: Date;
}): EnergyCursor[] {
  return segments.flatMap((segment) =>
    buildVisibleSegment({ ...segment, visibleEndDate, visibleStartDate }),
  );
}

/** Historical projection only; UserProgress remains authoritative for current Energy. */
export function projectEnergyTimeline({
  cursors,
  targetDate,
  visibleStartDate,
}: {
  cursors: EnergyCursor[];
  targetDate: Date;
  visibleStartDate?: Date;
}): EnergyTimelineProjection {
  const orderedCursors = sortEnergyCursors(cursors);
  const latestCursor = orderedCursors.at(-1);

  if (!latestCursor) {
    return { averageEnergy: null, visibleDays: [] };
  }

  const targetProjection = projectCurrentEnergy({ cursor: latestCursor, targetDate });
  const effectiveTargetDate = targetProjection.effectiveDate;
  const segments = buildEnergyTimelineSegments({ cursors: orderedCursors, effectiveTargetDate });

  const timelineSummary = summarizeEnergyTimeline(segments);

  const visibleDays = visibleStartDate
    ? buildVisibleEnergyDays({ segments, visibleEndDate: targetDate, visibleStartDate })
    : [];

  return { averageEnergy: timelineSummary.energySum / timelineSummary.dayCount, visibleDays };
}
