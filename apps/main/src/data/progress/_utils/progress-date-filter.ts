import { getDefaultStartDate } from "@zoonk/utils/date-ranges";

/**
 * Progress insight queries share the same optional closed date window. Keeping
 * the default lookback and optional end boundary here prevents Energy and Level
 * cards from drifting apart when their selected-period contract changes.
 */
export function getProgressDateFilter({
  endDateIso,
  startDateIso,
}: {
  endDateIso?: string;
  startDateIso?: string;
}) {
  const startDate = getDefaultStartDate(startDateIso);

  if (endDateIso) {
    return { gte: startDate, lte: new Date(endDateIso) };
  }

  return { gte: startDate };
}

export type ProgressDateFilter = ReturnType<typeof getProgressDateFilter>;
