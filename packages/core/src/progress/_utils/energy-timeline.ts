import { MS_PER_DAY } from "@zoonk/utils/date";
import { DAILY_DECAY, type EnergyCursor, MIN_ENERGY, projectCurrentEnergy } from "../energy";

export type EnergyTimelineProjection = {
  averageEnergy: number | null;
  visibleDays: EnergyCursor[];
};

type EnergyTimelineSummary = { dayCount: number; energySum: number };
type EnergyTimelineSegment = { cursor: EnergyCursor; endDate: Date };

/**
 * Energy dates are UTC-midnight calendar labels, so their timestamp distance
 * gives the exact number of learner-local calendar days between them.
 */
function getDateDifference({ endDate, startDate }: { endDate: Date; startDate: Date }): number {
  return Math.round((endDate.getTime() - startDate.getTime()) / MS_PER_DAY);
}

/**
 * Sorting a copy lets callers pass Prisma results or fixture data without
 * making timeline correctness depend on query ordering or mutating the input.
 */
function sortEnergyCursors(cursors: EnergyCursor[]): EnergyCursor[] {
  return cursors.toSorted((first, second) => first.date.getTime() - second.date.getTime());
}

/**
 * Each authoritative cursor owns only the missing dates before the next cursor.
 * The later cursor is excluded here because its stored Energy must win.
 */
function getMissingDayCount({ cursor, endDate }: { cursor: EnergyCursor; endDate: Date }): number {
  return Math.max(0, getDateDifference({ endDate, startDate: cursor.date }) - 1);
}

/**
 * Calculates a decayed value from one cursor while preserving the zero floor.
 */
function getEnergyAfterDays({
  cursor,
  dayOffset,
}: {
  cursor: EnergyCursor;
  dayOffset: number;
}): number {
  return Math.max(MIN_ENERGY, cursor.energyAtEnd - dayOffset * DAILY_DECAY);
}

/**
 * Gives each cursor the next authoritative date, or the effective target for
 * the final trailing segment, so every missing date has exactly one owner.
 */
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

/**
 * Sums a run of missing inactive days arithmetically, including the zero-valued
 * tail in its day count without allocating an entry for every lifetime date.
 */
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

/**
 * Adds one cursor and its synthetic interval to an accumulated lifetime
 * summary. Naming the operation keeps the timeline pipeline declarative.
 */
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

/**
 * Computes the all-time Energy average from cursor-sized segments, so a learner
 * with years at 0% does not require years of synthetic objects in memory.
 */
function summarizeEnergyTimeline(segments: EnergyTimelineSegment[]): EnergyTimelineSummary {
  return segments.reduce((summary, segment) => addEnergySegmentToSummary(summary, segment), {
    dayCount: 0,
    energySum: 0,
  });
}

/**
 * Expands only the missing part of one segment that intersects the requested
 * visible range. This keeps a bounded chart independent of lifetime length.
 */
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

/**
 * Adds an authoritative cursor when it is visible, followed by only the
 * synthetic inactive dates before the next authoritative cursor.
 */
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

/**
 * Maps the complete sparse timeline to only the dates the current view can
 * render, leaving old inactive intervals represented only in the summary.
 */
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

/**
 * Derives historical Energy from truthful learner-local completion dates.
 * UserProgress owns the current value separately, so this projection only
 * fills calendar gaps and calculates the allocation-bounded lifetime average.
 */
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
