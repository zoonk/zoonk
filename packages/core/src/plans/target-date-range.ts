import { z } from "zod";

export const MAX_PLAN_DAYS = 3650;

/** Moves a "YYYY-MM-DD" label by whole days at UTC, so the browser and the server agree. */
function addDays(isoDate: string, days: number): string {
  const [year = 0, month = 1, day = 1] = isoDate.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

export function getTargetDateBounds(today: string): { max: string; min: string } {
  return { max: addDays(today, MAX_PLAN_DAYS), min: addDays(today, 1) };
}

/**
 * Zod's `instanceof` matches any ZodError for this subclass, so tell it apart with
 * `isInputRangeError`.
 */
class InputRangeError extends z.ZodError {
  override name = "InputRangeError";
}

export function isInputRangeError(error: unknown): error is InputRangeError {
  return error instanceof z.ZodError && error.name === "InputRangeError";
}

type SuppliedTarget = {
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
 * Throws an `InputRangeError` for a new date outside `getTargetDateBounds`; the goal's own date
 * (`current`) always passes.
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
