import { createHash } from "node:crypto";
import { normalizeString } from "@zoonk/utils/string";
import { writtenGradingSchema } from "../../../library/exams/written-grading";
import { type listWrittenTasks } from "../../../library/exams/written-tasks";

type Basis = Pick<ReturnType<typeof listWrittenTasks>[number], "grading" | "lines" | "points">;

const DECIMAL_PLACES =
  /\b(?<places>\d+|one|two|three|four|zero|uma|duas|tres|quatro)\s+(?:decimal(?:s| places?)?|places?|casas? decimais?)\b/u;

const PLACE_WORDS: Readonly<Record<string, number>> = {
  duas: 2,
  four: 4,
  one: 1,
  quatro: 4,
  three: 3,
  tres: 3,
  two: 2,
  uma: 1,
  zero: 0,
};

export function getWritingRounding(rule: Basis["grading"]["rounding"]) {
  if (!rule) {
    return null;
  }

  const words = normalizeString(rule.citation.passage || rule.text);

  if (/\b(?:no rounding|without rounding|sem arredondamento)\b/u.test(words)) {
    return { mode: "none" as const };
  }

  const place = DECIMAL_PLACES.exec(words)?.groups?.places;
  const places = place === undefined ? Number.NaN : (PLACE_WORDS[place] ?? Number(place));

  if (!Number.isSafeInteger(places) || places < 0) {
    return "unknown" as const;
  }

  if (/\b(?:truncate|truncamento|truncar|round down|arredondamento para baixo)\b/u.test(words)) {
    return { mode: "down" as const, places };
  }

  return /\b(?:round|rounded|arredondamento|arredondar|arredondada|arredondado)\b/u.test(words)
    ? { mode: "nearest" as const, places }
    : ("unknown" as const);
}

function getWritingGradingFacts({ criteria, kind, language, rounding, zeroing }: Basis["grading"]) {
  return {
    criteria: criteria.map(({ points }) => points).toSorted((a, b) => (a ?? -1) - (b ?? -1)),
    kind,
    language: language && {
      factor: language.factor,
      formula: language.formula?.replaceAll(/\s+/gu, ""),
      method: language.method,
    },
    rounding: getWritingRounding(rounding),
    zeroing: zeroing.map(({ kinds, maxLines }) => ({
      kinds: [...(kinds ?? [])].toSorted(),
      maxLines: maxLines ?? null,
    })),
  };
}

export function getWritingRubricFingerprint({
  grading,
  points,
}: Pick<Basis, "grading" | "points">): string {
  return createHash("sha256")
    .update(JSON.stringify({ ...getWritingGradingFacts(grading), points }))
    .digest("hex");
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

  return prompt.taskBasis === taskBasis || legacyTaskBasis(prompt.taskBasis) === taskBasis;
}
