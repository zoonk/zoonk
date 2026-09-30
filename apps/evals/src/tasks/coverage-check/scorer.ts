import { createFixedScore } from "@/lib/score";
import { type TaskScorer } from "@/lib/types";
import { isJsonObject } from "@zoonk/utils/json";
import { normalizeString } from "@zoonk/utils/string";

type WeightRange = { max: number; min: number };

/** Syllabus lines the graph misses. Every other reference line must not be flagged. */
export type CoverageCheckExpected = {
  gaps: string[];
  /**
   * For an exam: the skills whose weight must change, with the weights accepted. A change to any
   * other skill is a false alarm.
   */
  examWeights?: (WeightRange & { key: string })[];
  /** For an exam: the weights accepted for the skill each planted gap adds, in `gaps` order. */
  gapWeights?: WeightRange[];
};

type Flagged = { examWeight: number | null; syllabusLine: string };
type WeightChange = { examWeight: number; key: string };
type Output = { flagged: Flagged[]; weightChanges: WeightChange[] };

const MIN_SCORE = 6;
const MAX_SCORE = 10;

function comparable(text: string): string {
  return normalizeString(text)
    .replaceAll(/[^\p{L}\p{N} ]/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
}

function matchesLine({ line, quote }: { line: string; quote: string }): boolean {
  const a = comparable(line);
  const b = comparable(quote);
  return a.length > 0 && b.length > 0 && (a.includes(b) || b.includes(a));
}

function toFlagged(skill: unknown): Flagged[] {
  if (!isJsonObject(skill) || typeof skill.syllabusLine !== "string") {
    return [];
  }

  const examWeight = typeof skill.examWeight === "number" ? skill.examWeight : null;
  return [{ examWeight, syllabusLine: skill.syllabusLine }];
}

function toWeightChange(change: unknown): WeightChange[] {
  return isJsonObject(change) &&
    typeof change.key === "string" &&
    typeof change.examWeight === "number"
    ? [{ examWeight: change.examWeight, key: change.key }]
    : [];
}

function parseOutput(output: string): Output | null {
  try {
    const parsed: unknown = JSON.parse(output);
    const missing = isJsonObject(parsed) ? parsed.missing : null;
    const changes = isJsonObject(parsed) ? parsed.examWeights : null;

    if (!Array.isArray(missing)) {
      return null;
    }

    return {
      flagged: missing.flatMap((skill) => toFlagged(skill)),
      weightChanges: Array.isArray(changes)
        ? changes.flatMap((change) => toWeightChange(change))
        : [],
    };
  } catch {
    return null;
  }
}

function getExpected(expected: unknown): CoverageCheckExpected {
  if (!isJsonObject(expected) || !Array.isArray(expected.gaps)) {
    throw new Error("Coverage-check test cases require the expected gaps.");
  }

  return {
    examWeights: Array.isArray(expected.examWeights)
      ? (expected.examWeights as CoverageCheckExpected["examWeights"])
      : undefined,
    gapWeights: Array.isArray(expected.gapWeights)
      ? (expected.gapWeights as CoverageCheckExpected["gapWeights"])
      : undefined,
    gaps: expected.gaps.filter((line): line is string => typeof line === "string"),
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** F1 of `hits` among `found` against `total` expected; nothing expected and nothing found is 1. */
function toF1({ hits, found, total }: { found: number; hits: number; total: number }) {
  if (total === 0 && found === 0) {
    return 1;
  }

  const recall = total === 0 ? 1 : hits / total;
  const precision = found === 0 ? 0 : hits / found;
  return recall + precision === 0 ? 0 : (2 * recall * precision) / (recall + precision);
}

function isInRange({ range, weight }: { range: WeightRange | undefined; weight: number | null }) {
  return range !== undefined && weight !== null && weight >= range.min && weight <= range.max;
}

/** Gap finding: a flagged line matching a planted gap is a hit, anything else a false alarm. */
function scoreGaps({ expected, flagged }: { expected: CoverageCheckExpected; flagged: Flagged[] }) {
  const quotes = flagged.map((skill) => skill.syllabusLine);
  const hits = quotes.filter((quote) => expected.gaps.some((line) => matchesLine({ line, quote })));
  const falseAlarms = quotes.filter((quote) => !hits.includes(quote));

  const found = expected.gaps.filter((line) =>
    quotes.some((quote) => matchesLine({ line, quote })),
  );

  const missed = expected.gaps.filter((line) => !found.includes(line));

  const details = [
    missed.length > 0 && `Missed: ${missed.join("; ")}.`,
    falseAlarms.length > 0 && `False alarms: ${falseAlarms.join("; ")}.`,
  ].filter(Boolean);

  return {
    details,
    f1: toF1({ found: quotes.length, hits: hits.length, total: expected.gaps.length }),
    falseAlarms,
    found,
  };
}

/** Weight corrections: an expected skill moved into its range is a hit, any other change a miss. */
function scoreWeightChanges({
  expected,
  weightChanges,
}: {
  expected: NonNullable<CoverageCheckExpected["examWeights"]>;
  weightChanges: WeightChange[];
}) {
  const hits = weightChanges.filter((change) =>
    isInRange({
      range: expected.find((item) => item.key === change.key),
      weight: change.examWeight,
    }),
  );

  const wrong = weightChanges
    .filter((change) => !hits.includes(change))
    .map((change) => `${change.key} → ${change.examWeight}`);

  const missed = expected
    .filter((item) => !hits.some((change) => change.key === item.key))
    .map((item) => item.key);

  const details = [
    missed.length > 0 && `Weights not corrected: ${missed.join(", ")}.`,
    wrong.length > 0 && `Wrong weight changes: ${wrong.join(", ")}.`,
  ].filter(Boolean);

  return {
    details,
    f1: toF1({ found: weightChanges.length, hits: hits.length, total: expected.length }),
  };
}

/** The share of found gaps whose new skill got a weight in its accepted range. */
function scoreGapWeights({
  expected,
  flagged,
}: {
  expected: CoverageCheckExpected;
  flagged: Flagged[];
}) {
  const weighed = expected.gaps.flatMap((line, index) => {
    const skill = flagged.find((item) => matchesLine({ line, quote: item.syllabusLine }));
    const range = expected.gapWeights?.[index];

    return skill ? [{ line, ok: isInRange({ range, weight: skill.examWeight }) }] : [];
  });

  const off = weighed.filter((item) => !item.ok).map((item) => item.line);

  return {
    details: off.length > 0 ? [`Gap weights out of range: ${off.join("; ")}.`] : [],
    share: weighed.length === 0 ? 1 : (weighed.length - off.length) / weighed.length,
  };
}

/**
 * Scores gap finding by F1 over the planted gaps: a flagged line matching a
 * planted gap is a hit, anything else is a false alarm. A case with no gaps
 * loses a point per false alarm, since inventing gaps is the failure there.
 * An exam case also scores its weights: the F1 of the weight corrections (a
 * change to a skill whose weight was right counts against it) and the share
 * of found gaps weighed within range, averaged with the gap F1.
 */
export const scoreCoverageCheck: TaskScorer<CoverageCheckExpected> = ({ output, testCase }) => {
  const expected = getExpected(testCase.expected);
  const parsed = parseOutput(output);

  if (!parsed) {
    return createFixedScore({
      conclusion: "The output has no missing-skills list.",
      score: MIN_SCORE,
    });
  }

  const gaps = scoreGaps({ expected, flagged: parsed.flagged });

  if (expected.gaps.length === 0 && !expected.examWeights) {
    return createFixedScore({
      conclusion: gaps.details.length === 0 ? "None" : gaps.details.join(" "),
      score: Math.max(MIN_SCORE, MAX_SCORE - gaps.falseAlarms.length),
    });
  }

  const weights = expected.examWeights
    ? scoreWeightChanges({ expected: expected.examWeights, weightChanges: parsed.weightChanges })
    : null;

  const gapWeights = expected.gapWeights
    ? scoreGapWeights({ expected, flagged: parsed.flagged })
    : null;

  const parts = [gaps.f1, weights?.f1, gapWeights?.share].filter((part) => part !== undefined);
  const quality = parts.reduce((total, part) => total + part, 0) / parts.length;
  const score = round(MIN_SCORE + (MAX_SCORE - MIN_SCORE) * quality);
  const details = [...gaps.details, ...(weights?.details ?? []), ...(gapWeights?.details ?? [])];

  return createFixedScore({
    conclusion:
      score === MAX_SCORE
        ? "None"
        : `Found ${gaps.found.length} of ${expected.gaps.length} gaps with ${gaps.falseAlarms.length} false alarms. ${details.join(" ")}`,
    score,
  });
};
