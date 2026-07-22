import { getDefaultStartDate } from "@zoonk/utils/date-ranges";

/**
 * Progress insight queries share the same optional closed date window. Keeping
 * the default lookback and optional end boundary here prevents Energy and Level
 * cards from drifting apart when their selected-period contract changes.
 */
export function getProgressDateFilter({
  endDate,
  startDate,
}: {
  endDate?: Date;
  startDate?: Date;
}) {
  const resolvedStartDate = startDate ?? getDefaultStartDate();

  if (endDate) {
    return { gte: resolvedStartDate, lte: endDate };
  }

  return { gte: resolvedStartDate };
}

export type ProgressDateFilter = ReturnType<typeof getProgressDateFilter>;
