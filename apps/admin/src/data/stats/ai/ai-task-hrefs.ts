import { getAiTaskHref } from "./ai-task-stats";

/**
 * The AI stats routes share the same date-range query contract. Building those
 * search params in one place keeps the index, detail, and estimates links aligned
 * as the on-demand reporting flow grows.
 */
function buildAiTaskSearchParams({
  endDate,
  runCount,
  startDate,
  view,
}: {
  endDate: string;
  runCount?: number;
  startDate: string;
  view?: string;
}) {
  return new URLSearchParams(getAiTaskSearchEntries({ endDate, runCount, startDate, view }));
}

/**
 * `URLSearchParams` expects an iterable of `[key, value]` pairs. Returning the
 * full entry list from one helper keeps the tuple typing intact and avoids
 * hand-built query arrays drifting across routes.
 */
function getAiTaskSearchEntries({
  endDate,
  runCount,
  startDate,
  view,
}: {
  endDate: string;
  runCount?: number;
  startDate: string;
  view?: string;
}): [string, string][] {
  return [
    buildAiTaskSearchEntry({ key: "from", value: startDate }),
    buildAiTaskSearchEntry({ key: "to", value: endDate }),
    ...getOptionalAiTaskSearchEntries({ runCount, view }),
  ];
}

/**
 * Building entries through a tiny helper keeps TypeScript from widening the
 * tuple shape to `string[]`, which `URLSearchParams` does not accept here.
 */
function buildAiTaskSearchEntry({ key, value }: { key: string; value: string }): [string, string] {
  return [key, value];
}

/**
 * Optional AI stats fields should only appear in the URL when the user actually
 * asked for that view. Keeping those entries in a helper avoids ad hoc query
 * string building across the admin pages.
 */
function getOptionalAiTaskSearchEntries({
  runCount,
  view,
}: {
  runCount?: number;
  view?: string;
}): [string, string][] {
  return [
    ...(runCount === undefined
      ? []
      : [buildAiTaskSearchEntry({ key: "runs", value: String(runCount) })]),
    ...(view ? [buildAiTaskSearchEntry({ key: "view", value: view })] : []),
  ];
}

/**
 * The AI stats index can now stay passive by default and only opt into live
 * reporting when the user requests a specific summary view.
 */
export function buildAiTaskIndexHref({
  endDate,
  startDate,
  view,
}: {
  endDate: string;
  startDate: string;
  view?: string;
}) {
  const searchParams = buildAiTaskSearchParams({ endDate, startDate, view });
  return `/stats/ai?${searchParams.toString()}` as const;
}

/**
 * Task detail links preserve the active date range and any optional drill-down
 * state so admins can move between overview and breakdown views without losing
 * the context they selected on the index page.
 */
export function buildAiTaskReportHref({
  endDate,
  runCount,
  startDate,
  taskName,
  view,
}: {
  endDate: string;
  runCount?: number;
  startDate: string;
  taskName: string;
  view?: string;
}) {
  const searchParams = buildAiTaskSearchParams({ endDate, runCount, startDate, view });
  return `${getAiTaskHref(taskName)}?${searchParams.toString()}`;
}

/**
 * The estimates route reads the same shared date range as the task pages. This
 * helper keeps the cross-link from the index consistent with that contract.
 */
export function buildAiEstimateHref({
  endDate,
  startDate,
}: {
  endDate: string;
  startDate: string;
}) {
  const searchParams = buildAiTaskSearchParams({ endDate, startDate });
  return `/stats/ai/estimates?${searchParams.toString()}` as const;
}
