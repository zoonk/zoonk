import { writtenGradingSchema } from "../../../library/exams/written-grading";
import { type listWrittenTasks } from "../../../library/exams/written-tasks";

type Basis = Pick<ReturnType<typeof listWrittenTasks>[number], "grading" | "lines" | "points">;

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
    zeroing: zeroing.map(({ kinds, maxLines }) => ({
      kinds: [...(kinds ?? [])].toSorted(),
      maxLines: maxLines ?? null,
    })),
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

/** A basis issued while sheets carried a `kind` reads as the same sheet without it. */
function withoutStoredKind(saved: string): string | null {
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
    { ...facts, ...(suppressed && { totalSuppressed: true }) },
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

  return [
    prompt.taskBasis,
    withoutStoredKind(prompt.taskBasis),
    legacyTaskBasis(prompt.taskBasis),
  ].includes(taskBasis);
}
