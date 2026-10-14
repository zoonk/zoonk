import { z } from "zod";

/** Ten years is past any real goal at any pace; what doesn't fit by then isn't planned. */
export const MAX_PLAN_DAYS = 3650;

/** A calendar label ("YYYY-MM-DD") moved by whole days, at UTC, alike in the browser and on the server. */
function addDays(isoDate: string, days: number): string {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/**
 * The days a new target date can take, as calendar labels: from tomorrow, since a plan counts
 * down to a day still ahead, to `MAX_PLAN_DAYS` after today, the last day a planning run lays out
 * from today (a later one would be cut off without a word). The caller gives the learner's today;
 * nothing here reads the clock.
 */
export function getTargetDateBounds(today: string): { max: string; min: string } {
  return { max: addDays(today, MAX_PLAN_DAYS), min: addDays(today, 1) };
}

/**
 * A request's target date outside `getTargetDateBounds`. The API answers it with
 * `TARGET_DATE_OUT_OF_RANGE` (422) for a change and `VALIDATION_ERROR` (400) for a query; every
 * other ZodError stays a server error. Tell it apart with `isInputRangeError`: Zod's `instanceof`
 * takes any ZodError for this one.
 */
class InputRangeError extends z.ZodError {
  override name = "InputRangeError";
}

/** Whether `error` is an `InputRangeError`, and not just any ZodError. */
export function isInputRangeError(error: unknown): error is InputRangeError {
  return error instanceof z.ZodError && error.name === "InputRangeError";
}

/** A date a request supplies, where it sits in the request, and the goal's own date, if any. */
type SuppliedTarget = {
  /** The goal's date now: sending it again changes nothing, so it's never judged again. */
  current?: string | null;
  path: PropertyKey[];
  targetDate: string | null | undefined;
};

function findIssue({
  bounds,
  latestOnly,
  target: { current, path, targetDate },
}: {
  bounds: ReturnType<typeof getTargetDateBounds>;
  latestOnly: boolean;
  target: SuppliedTarget;
}): z.core.$ZodIssueCustom | null {
  if (!targetDate || targetDate === current) {
    return null;
  }

  if (targetDate > bounds.max) {
    return {
      code: "custom",
      input: targetDate,
      message: `Pick a date by ${bounds.max}: plans reach at most ${MAX_PLAN_DAYS} days ahead`,
      params: { bound: "latest", limit: bounds.max },
      path,
    };
  }

  if (!latestOnly && targetDate < bounds.min) {
    return {
      code: "custom",
      input: targetDate,
      message: `Pick a date from ${bounds.min}: a plan counts down to a day still ahead`,
      params: { bound: "earliest", limit: bounds.min },
      path,
    };
  }

  return null;
}

/**
 * Refuses new target dates outside `getTargetDateBounds` with an `InputRangeError`, before
 * anything is saved, asked of a model or cached. No date, an absent one and the goal's own
 * (`current`) always pass, so a goal whose date has passed keeps it while other settings change.
 * `latestOnly` leaves an earlier date to the answer it already had: the planner's `pastDate`, a
 * draft's `invalid`, or none where a new goal's past date was always taken.
 */
export function assertTargetDates({
  latestOnly = false,
  targets,
  today,
}: {
  latestOnly?: boolean;
  targets: readonly SuppliedTarget[];
  today: string;
}): void {
  const bounds = getTargetDateBounds(today);

  const issues = targets
    .map((target) => findIssue({ bounds, latestOnly, target }))
    .filter((issue) => issue !== null);

  if (issues.length > 0) {
    throw new InputRangeError(issues);
  }
}
