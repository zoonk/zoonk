import { writtenGradingSchema } from "../../../library/exams/written-grading";
import { type listWrittenTasks } from "../../../library/exams/written-tasks";

type Basis = Pick<ReturnType<typeof listWrittenTasks>[number], "grading" | "lines" | "points">;
type ZeroRule = { kinds?: readonly string[] | null; maxLines?: number | null };

const LINE_COUNTED_ZEROS = new Set(["copiedSupport", "tooFewLines"]);

/**
 * The answers a sheet zeroes, whichever way its notice was read into rules: one rule naming two
 * triggers zeroes what two rules naming one each do. A line limit belongs only to triggers counted
 * in lines.
 */
function groupZeroTriggers(zeroing: readonly ZeroRule[]) {
  const triggers = zeroing.flatMap(({ kinds, maxLines }) =>
    (kinds ?? []).map((kind) => ({
      kind,
      maxLines: LINE_COUNTED_ZEROS.has(kind) ? (maxLines ?? null) : null,
    })),
  );

  return [...Map.groupBy(triggers, ({ maxLines }) => maxLines)]
    .map(([maxLines, own]) => ({
      kinds: [...new Set(own.map(({ kind }) => kind))].toSorted(),
      maxLines,
    }))
    .toSorted((first, second) => (first.maxLines ?? 0) - (second.maxLines ?? 0));
}

function readsAsNumbers(rounding: Basis["grading"]["rounding"]) {
  return rounding && { mode: rounding.mode, stage: rounding.stage, step: rounding.step };
}

/**
 * The facts that change a mark. Fields a sheet states only when it has them are left out when
 * absent, so a sheet without them keeps the basis it was issued with.
 */
function getWritingGradingFacts(grading: Basis["grading"]) {
  const { combination, criteria, language, limits, rounding, totalSuppressed, zeroing } = grading;

  const scales = criteria.flatMap(({ awards, id, weight }) =>
    awards ? [{ awards, id, weight }] : [],
  );

  return {
    criteria: criteria.map(({ points }) => points).toSorted((a, b) => (a ?? -1) - (b ?? -1)),
    language: language && {
      factor: language.factor,
      formula: language.formula?.replaceAll(/\s+/gu, ""),
      method: language.method,
    },
    rounding: readsAsNumbers(rounding),
    zeroing: groupZeroTriggers(zeroing),
    ...(combination && { combination: { method: combination.method, step: combination.step } }),
    ...(limits?.length && { limits: limits.map(({ criteria: ids, max }) => ({ ids, max })) }),
    ...(scales.length > 0 && {
      scales: scales.map(({ awards, id, weight }) => ({
        awards: awards.map(({ count, points, pointsHigh }) => [points, pointsHigh, count]),
        id,
        weight,
      })),
    }),
    ...(totalSuppressed && { totalSuppressed }),
  };
}

export function getWritingTaskBasis({ grading, lines, points }: Basis): string {
  return JSON.stringify([lines, points, getWritingGradingFacts(grading)]);
}

function readTaskBasis(saved: string): unknown {
  try {
    return JSON.parse(saved);
  } catch {
    return null;
  }
}

function hasPointedCriterion(facts: object): boolean {
  return (
    "criteria" in facts &&
    Array.isArray(facts.criteria) &&
    facts.criteria.some((points: unknown) => typeof points === "number")
  );
}

/**
 * A basis issued while sheets carried a `kind` reads as the same sheet without it. Its rounding
 * was guessed from the rule's wording, in a shape no sheet has now, so it takes the task's.
 */
function withoutStoredKind(saved: string, rounding: unknown): string | null {
  const value = readTaskBasis(saved);

  if (!Array.isArray(value)) {
    return null;
  }

  const [lines, points, grading] = value as unknown[];

  if (typeof grading !== "object" || grading === null || !("kind" in grading)) {
    return null;
  }

  const { kind, ...facts } = grading;
  const suppressed = kind === "levels" && hasPointedCriterion(facts);

  return JSON.stringify([
    lines,
    points,
    { ...facts, rounding, ...(suppressed && { totalSuppressed: true }) },
  ]);
}

function legacyTaskBasis(saved: string): string | null {
  const value = readTaskBasis(saved);

  if (!Array.isArray(value)) {
    return null;
  }

  const [lines, points, grading] = value as unknown[];

  const restored =
    typeof grading === "object" && grading
      ? Object.fromEntries(
          Object.entries(grading).map(([key, entry]: [string, unknown]) => [
            key,
            restoreCitations(key, entry),
          ]),
        )
      : null;

  const parsed = writtenGradingSchema.safeParse(restored);

  return parsed.success &&
    (typeof lines === "number" || lines === null) &&
    (typeof points === "number" || points === null)
    ? getWritingTaskBasis({ grading: parsed.data, lines, points })
    : null;
}

function restoreCitations(key: string, entry: unknown): unknown {
  if (key === "criteria" || key === "zeroing") {
    return Array.isArray(entry) ? entry.map((rule: unknown) => withCitation(rule)) : entry;
  }

  return key === "language" || key === "rounding" ? withCitation(entry) : entry;
}

function withCitation(value: unknown) {
  return value && typeof value === "object"
    ? { ...value, citation: { passage: "", sourceId: "" } }
    : value;
}

function isZeroRule(rule: unknown): rule is ZeroRule {
  return typeof rule === "object" && rule !== null;
}

/** A stored basis with its zero rules grouped as a new reading groups them. */
function withGroupedZeroTriggers(saved: string | null): string | null {
  const value = saved === null ? null : readTaskBasis(saved);

  if (!Array.isArray(value)) {
    return saved;
  }

  const [lines, points, grading] = value as unknown[];

  if (
    typeof grading !== "object" ||
    grading === null ||
    !("zeroing" in grading) ||
    !Array.isArray(grading.zeroing) ||
    !grading.zeroing.every((rule) => isZeroRule(rule))
  ) {
    return saved;
  }

  return JSON.stringify([
    lines,
    points,
    { ...grading, zeroing: groupZeroTriggers(grading.zeroing) },
  ]);
}

export function matchesWritingTaskBasis({
  prompt,
  task,
}: {
  prompt: Basis & { taskBasis?: string };
  task: Basis;
}): boolean {
  const taskBasis = getWritingTaskBasis(task);

  if (!prompt.taskBasis) {
    return getWritingTaskBasis(prompt) === taskBasis;
  }

  const rounding = readsAsNumbers(task.grading.rounding);

  return [
    prompt.taskBasis,
    withoutStoredKind(prompt.taskBasis, rounding),
    legacyTaskBasis(prompt.taskBasis),
  ]
    .map((saved) => withGroupedZeroTriggers(saved))
    .includes(taskBasis);
}

/**
 * Whether a saved answer still answers this task: a whole answer to it, marked by the rules the
 * task has now. A correction that changes how the task is marked leaves earlier answers out of
 * its estimate and out of a mock's verdict alike.
 */
export function answersWritingTask({
  prompt,
  task,
}: {
  prompt: Basis & { taskBasis?: string; taskKey: string; unit: string };
  task: Basis & { key: string };
}): boolean {
  return (
    prompt.taskKey === task.key &&
    prompt.unit === "answer" &&
    matchesWritingTaskBasis({ prompt, task })
  );
}
