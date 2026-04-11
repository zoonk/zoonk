import {
  buildGatewayTaskTag,
  extractGatewayDefaultModel,
  extractGatewayTaskName,
} from "@zoonk/core/ai";
import { MS_PER_DAY, parseLocalDate } from "@zoonk/utils/date";

const AI_TASK_NAME_PATTERN = /^[a-z0-9-]+$/;
const AI_MODEL_ID_PATTERN = /^[a-z0-9.-]+\/[a-z0-9.-]+$/;
const DATE_INPUT_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DEFAULT_LOOKBACK_DAYS = 30;
const DEFAULT_ESTIMATE_RUN_COUNT = 1000;

type AiTaskDateRange = {
  end: Date;
  endInput: string;
  start: Date;
  startInput: string;
};

/**
 * AI Gateway reporting groups tagged generations under a raw `task:*` string.
 * This extracts the stable task name we use in URLs and filters while ignoring
 * any future non-task tags that might be added for other reporting dimensions.
 */
export function extractAiTaskName(tag?: string): string | null {
  const taskName = extractGatewayTaskName(tag);
  return isAiTaskName(taskName) ? taskName : null;
}

/**
 * Default-model tags come from Gateway reporting and should look like provider
 * model ids such as `openai/gpt-5.4`. We validate the shape before using them
 * so malformed tags cannot affect fallback comparisons in the admin UI.
 */
export function extractAiDefaultModel(tag?: string): string | null {
  const model = extractGatewayDefaultModel(tag);
  return isAiModelId(model) ? model : null;
}

/**
 * The admin UI needs a readable label for hyphenated task ids such as
 * `course-suggestions`. Converting them once here keeps the list page, detail
 * page, and breadcrumbs aligned instead of each component formatting ids itself.
 */
export function formatAiTaskLabel(taskName: string): string {
  return taskName
    .split("-")
    .filter(Boolean)
    .map((segment) => capitalizeWord(segment))
    .join(" ");
}

/**
 * Gateway filters expect the original `task:*` tag, so this helper keeps the
 * prefix in one place and avoids string concatenation drift across callers.
 */
export function buildAiTaskTag(taskName: string): string {
  return buildGatewayTaskTag(taskName);
}

/**
 * The task detail route receives a free-form path segment. We validate it before
 * sending it to the gateway so malformed values cannot become reporting filters.
 */
export function isAiTaskName(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && AI_TASK_NAME_PATTERN.test(value);
}

/**
 * Gateway model ids always have a provider prefix and a model name separated by
 * `/`. This small validator is enough for reporting tags without pulling in a
 * broader schema dependency into the admin package.
 */
function isAiModelId(value: string | null | undefined): value is string {
  return value !== null && value !== undefined && AI_MODEL_ID_PATTERN.test(value);
}

/**
 * A model row counts as fallback when Gateway served a model that is not listed
 * among the task's tagged default models for the selected time range.
 */
export function isFallbackModel({
  defaultModels,
  model,
}: {
  defaultModels: string[];
  model: string;
}): boolean {
  if (defaultModels.length === 0) {
    return false;
  }

  return !defaultModels.includes(model);
}

/**
 * The AI stats pages default to the last 30 calendar days, including today.
 * When the user supplies only one side of the range, we keep the experience
 * predictable by filling the missing side instead of dropping back to an empty
 * or invalid query.
 */
export function resolveAiTaskDateRange({
  from,
  now = new Date(),
  to,
}: {
  from?: string;
  now?: Date;
  to?: string;
}): AiTaskDateRange {
  const defaultRange = getDefaultAiTaskDateRange(now);
  const parsedEnd = parseDateInput(to);
  const parsedStart = parseDateInput(from);
  const end = parsedEnd ?? defaultRange.end;
  const start =
    parsedStart ??
    (parsedEnd ? shiftUtcDays(end, -(DEFAULT_LOOKBACK_DAYS - 1)) : defaultRange.start);

  if (start.getTime() > end.getTime()) {
    return defaultRange;
  }

  return buildAiTaskDateRange({ end, start });
}

/**
 * The cost estimator should always have a usable number. We accept only positive
 * whole numbers and fall back to a friendly default so the page can render an
 * estimate immediately without client-side state.
 */
export function resolveEstimateRunCount(value?: string): number {
  const parsedValue = Number.parseInt(value ?? "", 10);
  return Number.isInteger(parsedValue) && parsedValue > 0
    ? parsedValue
    : DEFAULT_ESTIMATE_RUN_COUNT;
}

/**
 * Gateway reporting returns accumulated market cost and request counts. The
 * calculator and per-model table both need the normalized per-request cost.
 */
export function calculateAverageMarketCostPerRequest({
  marketCost,
  requestCount,
}: {
  marketCost: number;
  requestCount: number;
}): number {
  if (requestCount <= 0) {
    return 0;
  }

  return marketCost / requestCount;
}

/**
 * The admin estimate is a simple linear forecast based on the historical average
 * market cost per request in the selected date range.
 */
export function calculateEstimatedMarketCost({
  averageMarketCostPerRequest,
  runCount,
}: {
  averageMarketCostPerRequest: number;
  runCount: number;
}): number {
  return averageMarketCostPerRequest * runCount;
}

/**
 * Date inputs and the gateway reporting API both use `YYYY-MM-DD`. Formatting the
 * value from UTC avoids local-time drift when the server runs in another timezone.
 */
function formatAiTaskDateInput(date: Date): string {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

/**
 * Every task detail view lives under the same route pattern. Centralizing that
 * path builder keeps the list page and the filter reset link aligned.
 */
export function getAiTaskHref(taskName: string): `/stats/ai/${string}` {
  return `/stats/ai/${taskName}` as const;
}

/**
 * The default task list and task detail pages share the same last-30-days window.
 * This helper keeps that convention centralized so those pages do not drift.
 */
function getDefaultAiTaskDateRange(now: Date): AiTaskDateRange {
  const end = getUtcCalendarDay(now);
  const start = shiftUtcDays(end, -(DEFAULT_LOOKBACK_DAYS - 1));

  return buildAiTaskDateRange({ end, start });
}

/**
 * Gateway date filters are calendar-day based, so we normalize `now` to the
 * current UTC day before doing any range math.
 */
function getUtcCalendarDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

/**
 * The shared date parser from `@zoonk/utils/date` intentionally trusts the input
 * format. We add a round-trip check here so impossible values like `2026-02-31`
 * do not silently roll over to another month in the admin filters.
 */
function parseDateInput(value?: string): Date | null {
  if (!value || !DATE_INPUT_PATTERN.test(value)) {
    return null;
  }

  const parsedDate = parseLocalDate(value);
  return formatAiTaskDateInput(parsedDate) === value ? parsedDate : null;
}

/**
 * The filters operate on whole UTC days. Moving ranges by raw day counts keeps
 * the report queries stable without introducing locale-sensitive time math.
 */
function shiftUtcDays(date: Date, dayOffset: number): Date {
  return new Date(date.getTime() + dayOffset * MS_PER_DAY);
}

/**
 * A single helper assembles the raw `Date` values and the `YYYY-MM-DD` strings
 * we need for both the gateway request and the date input default values.
 */
function buildAiTaskDateRange({ end, start }: { end: Date; start: Date }): AiTaskDateRange {
  return {
    end,
    endInput: formatAiTaskDateInput(end),
    start,
    startInput: formatAiTaskDateInput(start),
  };
}

/**
 * Task ids are hyphenated lowercase slugs. Title-casing each word is enough for
 * the admin UI and keeps the transformation explicit instead of pulling in a
 * broader string utility for one narrow job.
 */
function capitalizeWord(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
