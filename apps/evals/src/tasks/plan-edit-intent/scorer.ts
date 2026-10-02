import { createFixedScore } from "@/lib/score";
import { type ClassificationOutcome, type TaskScorer } from "@/lib/types";
import { isJsonObject } from "@zoonk/utils/json";

/** A number the change must use, or a range when the request doesn't name one ("less"). */
type ExpectedMinutes = number | { max: number; min: number };

export type ExpectedChange = {
  activities?: string[];
  areas?: string[];
  bias?: string;
  date?: string | null;
  kind: string;
  minutes?: ExpectedMinutes;
  weekdays?: number[];
};

/**
 * What the request asks for. `alternatives` lists other change sets that are just as right, such
 * as a daily time plus a Saturday instead of five weekdays plus a Saturday.
 */
export type PlanEditExpected = { alternatives?: ExpectedChange[][]; changes: ExpectedChange[] };

type GeneratedOperation = Record<string, unknown> & { kind: string };

const FULL = 10;
const MIN_SCORE = 1;
const EXTRA_PENALTY = 3;

function parseOutput(output: string): {
  kind: string | null;
  operations: GeneratedOperation[] | null;
  understood: boolean;
} {
  try {
    const parsed: unknown = JSON.parse(output);

    if (!isJsonObject(parsed)) {
      return { kind: null, operations: null, understood: false };
    }

    if (typeof parsed.kind === "string" && !Array.isArray(parsed.operations)) {
      /** The classifier names clearing the date apart; the planner sets it to none. */
      const kind = parsed.kind === "clearTargetDate" ? "setTargetDate" : parsed.kind;
      return { kind, operations: null, understood: kind !== "none" };
    }

    const operations = (Array.isArray(parsed.operations) ? parsed.operations : []).flatMap(
      (operation: unknown): GeneratedOperation[] =>
        isJsonObject(operation) && typeof operation.kind === "string"
          ? [{ ...operation, kind: operation.kind }]
          : [],
    );

    return {
      kind: operations[0]?.kind ?? "none",
      operations,
      understood: parsed.understood === true,
    };
  } catch {
    return { kind: null, operations: null, understood: false };
  }
}

function sameSet(a: unknown, b: readonly (number | string)[]): boolean {
  return Array.isArray(a) && a.length === b.length && b.every((value) => a.includes(value));
}

function matchesMinutes(value: unknown, expected: ExpectedMinutes): boolean {
  if (typeof value !== "number") {
    return false;
  }

  return typeof expected === "number"
    ? value === expected
    : value >= expected.min && value <= expected.max;
}

function getValue(operation: GeneratedOperation, keys: string[]): unknown {
  return keys.map((key) => operation[key]).find((value) => value !== undefined);
}

function matches(operation: GeneratedOperation, expected: ExpectedChange): boolean {
  const checks = [
    operation.kind === expected.kind,
    expected.minutes === undefined || matchesMinutes(operation.minutes, expected.minutes),
    expected.weekdays === undefined || sameSet(operation.weekdays, expected.weekdays),
    expected.areas === undefined || sameSet(operation.areas, expected.areas),
    expected.activities === undefined || sameSet(operation.activities, expected.activities),
    expected.bias === undefined || operation.bias === expected.bias,
    expected.date === undefined ||
      getValue(operation, ["startDate", "targetDate"]) === expected.date,
  ];

  return checks.every(Boolean);
}

/** Matches each expected change to one generated operation; returns what's missing and extra. */
function compare({
  expected,
  operations,
}: {
  expected: ExpectedChange[];
  operations: GeneratedOperation[];
}) {
  const unused = [...operations];

  const missing = expected.filter((change) => {
    const index = unused.findIndex((operation) => matches(operation, change));

    if (index === -1) {
      return true;
    }

    unused.splice(index, 1);
    return false;
  });

  return { extra: unused, missing };
}

function scoreComparison({
  expected,
  operations,
}: {
  expected: ExpectedChange[];
  operations: GeneratedOperation[];
}) {
  const { extra, missing } = compare({ expected, operations });
  const matched = expected.length - missing.length;

  const score = Math.max(
    MIN_SCORE,
    Math.round((FULL * matched) / expected.length) - EXTRA_PENALTY * extra.length,
  );

  const problems = [
    ...missing.map((change) => `Missing ${JSON.stringify(change)}.`),
    ...extra.map((operation) => `Unexpected ${JSON.stringify(operation)}.`),
  ];

  return { problems, score };
}

/**
 * Deterministic: the planner applies exactly these changes, so each one must have the right kind,
 * days, minutes, dates and areas, with nothing extra. A request that isn't a plan change must come
 * back not understood. Evaluation models only pick the first change's kind, so they're scored on
 * that alone.
 */
export const scorePlanEditIntent: TaskScorer<PlanEditExpected> = ({ output, testCase }) => {
  const expected = testCase.expected;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} needs expected values.`);
  }

  const generated = parseOutput(output);

  const classification: ClassificationOutcome = {
    expected: expected.changes[0]?.kind ?? "none",
    predicted: generated.kind,
  };

  if (generated.operations === null) {
    const right = generated.kind === classification.expected;

    return {
      ...createFixedScore({
        conclusion: right ? "None" : `Expected ${classification.expected}.`,
        score: right ? FULL : MIN_SCORE,
      }),
      classification,
    };
  }

  if (expected.changes.length === 0) {
    const right = !generated.understood && generated.operations.length === 0;

    return {
      ...createFixedScore({
        conclusion: right ? "None" : "Expected no plan change.",
        score: right ? FULL : MIN_SCORE,
      }),
      classification,
    };
  }

  const results = [expected.changes, ...(expected.alternatives ?? [])].map((changes) =>
    scoreComparison({ expected: changes, operations: generated.operations ?? [] }),
  );

  const best = results.toSorted((a, b) => b.score - a.score)[0] ?? {
    problems: ["No changes"],
    score: MIN_SCORE,
  };

  return {
    ...createFixedScore({ conclusion: best.problems.join(" ") || "None", score: best.score }),
    classification,
  };
};
