import { createFixedScore } from "@/lib/score";
import { detectLanguage } from "@/lib/text-language";
import { type TaskScorer } from "@/lib/types";
import { type GradeWritingOutput } from "./task";
import { type GradeWritingExpected, type GradeWritingInput } from "./test-cases";

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

/** How far the content points may sit from the answer standard's, as a share of the maximum. */
const CONTENT_TOLERANCE = 0.1;
/** The CGU notice's written minimum is half the part's points. */
const PASS_SHARE = 0.5;
const MIN_QUOTED_SHARE = 0.6;
const MIN_ERROR_RECALL = 0.5;
const LEVEL_RANK = { complete: 3, missing: 0, partial: 1, strong: 2 } as const;

type Check = { name: string; passed: boolean; detail: string };
type Side = "fail" | "pass" | "uncertain";
type Span = { start: number; end: number };

function spansOf(text: string, anchors: readonly string[]): Span[] {
  return anchors.flatMap((anchor) => {
    const spans: Span[] = [];
    let start = text.indexOf(anchor);

    while (start !== -1) {
      spans.push({ end: start + anchor.length, start });
      start = text.indexOf(anchor, start + 1);
    }

    return spans;
  });
}

function overlaps(span: Span, spans: Span[]): boolean {
  return spans.some((other) => other.start < span.end && span.start < other.end);
}

function errorChecks({
  expected,
  output,
  planted,
  text,
}: {
  expected: GradeWritingExpected;
  output: GradeWritingOutput;
  planted: boolean;
  text: string;
}): Check[] {
  const real = spansOf(text, expected.languageErrors);
  const traps = spansOf(text, expected.traps ?? []);

  const reported = output.result.errors.map((error) => ({
    ...error,
    span: { end: error.start + error.quote.length, start: error.start },
  }));

  const wrong = reported.filter((error) => !overlaps(error.span, real));
  const trapped = wrong.filter((error) => overlaps(error.span, traps));

  const found = expected.languageErrors.filter((anchor) =>
    reported.some((error) => overlaps(error.span, spansOf(text, [anchor]))),
  );

  const describe = (errors: typeof wrong) =>
    errors.map((error) => `"${error.quote}" → "${error.correction}"`).join("; ");

  const recall: Check[] =
    planted && expected.languageErrors.length >= 2
      ? [
          {
            detail: `Found ${found.length} of ${expected.languageErrors.length} real errors.`,
            name: "error-recall",
            passed: found.length >= expected.languageErrors.length * MIN_ERROR_RECALL,
          },
        ]
      : [];

  return [
    {
      detail:
        wrong.length === 0
          ? `No false errors (${reported.length} reported, ${found.length}/${expected.languageErrors.length} real found).`
          : `False errors: ${describe(wrong)}.`,
      name: "false-errors",
      passed: wrong.length === 0,
    },
    {
      detail:
        trapped.length === 0
          ? "No accepted usage flagged."
          : `Accepted usage flagged: ${describe(trapped)}.`,
      name: "traps",
      passed: trapped.length === 0,
    },
    ...recall,
  ];
}

/** Earned the way the arithmetic counts it: once, on its criterion, with an exact quote. */
function creditedAspects({ output, text }: { output: GradeWritingOutput; text: string }) {
  const byIndex = Map.groupBy(output.evidence.aspects, (aspect) => aspect.aspectIndex);

  return new Set(
    [...byIndex.entries()].flatMap(([index, reports]) => {
      const [report] = reports;
      const quote = report?.quote ?? "";
      const once = quote.trim() !== "" && text.indexOf(quote) === text.lastIndexOf(quote);
      return reports.length === 1 && report?.earned && text.includes(quote) && once ? [index] : [];
    }),
  );
}

function creditChecks({
  expected,
  input,
  output,
  text,
}: {
  expected: GradeWritingExpected;
  input: GradeWritingInput;
  output: GradeWritingOutput;
  text: string;
}): Check[] {
  const credited = creditedAspects({ output, text });
  const uncertain = new Set(expected.uncertain);
  const earned = new Set(expected.earned);

  const indexes = input.basis.aspects
    .map((_, index) => index)
    .filter((index) => !uncertain.has(index));

  const falseCredit = indexes.filter((index) => credited.has(index) && !earned.has(index));
  const missed = indexes.filter((index) => !credited.has(index) && earned.has(index));

  const detail = `Credited ${[...credited].toSorted((a, b) => a - b).join(",") || "none"}; expected ${expected.earned.join(",") || "none"}${uncertain.size > 0 ? ` (either way: ${[...uncertain].join(",")})` : ""}. False credit: ${falseCredit.join(",") || "none"}; missed: ${missed.join(",") || "none"}.`;

  if (input.basis.points === null || input.arithmetic === null) {
    return [{ detail, name: "credit", passed: falseCredit.length + missed.length <= 1 }];
  }

  const value = (chosen: Iterable<number>) =>
    [...chosen].reduce((sum, index) => sum + (input.basis.aspects[index]?.points ?? 0), 0);

  const truth = { high: value([...earned, ...uncertain]), low: value(earned) };
  const predicted = value(credited);
  const tolerance = input.basis.points * CONTENT_TOLERANCE;

  return [
    {
      detail: `${detail} Content ${predicted} against ${truth.low}–${truth.high} of ${input.basis.points}.`,
      name: "credit",
      passed: predicted >= truth.low - tolerance && predicted <= truth.high + tolerance,
    },
  ];
}

function truthSide({
  expected,
  input,
  output,
}: {
  expected: GradeWritingExpected;
  input: GradeWritingInput;
  output: GradeWritingOutput;
}): Side {
  const { basis } = input;
  const max = basis.points ?? 0;

  const value = (indexes: number[]) =>
    indexes.reduce((sum, i) => sum + (basis.aspects[i]?.points ?? 0), 0);

  const factor = basis.grading.language?.factor ?? 0;
  const lines = Math.max(1, Math.min(output.estimatedLines, basis.lines ?? output.estimatedLines));
  const deduction = (factor * expected.languageErrors.length) / lines;

  const totals = expected.zero
    ? [0, 0]
    : [value(expected.earned), value([...expected.earned, ...(expected.uncertain ?? [])])].map(
        (content) => Math.max(0, content - deduction),
      );

  const threshold = max * PASS_SHARE;

  if (totals.every((total) => total >= threshold)) {
    return "pass";
  }

  return totals.every((total) => total < threshold) ? "fail" : "uncertain";
}

function predictedSide({
  input,
  output,
}: {
  input: GradeWritingInput;
  output: GradeWritingOutput;
}): Side | null {
  const { result } = output;

  if (result.kind !== "points") {
    return null;
  }

  const threshold = (input.basis.points ?? 0) * PASS_SHARE;

  if (result.total.low >= threshold) {
    return "pass";
  }

  return result.total.high < threshold ? "fail" : "uncertain";
}

function zeroCheck({
  expected,
  output,
}: {
  expected: GradeWritingExpected;
  output: GradeWritingOutput;
}): Check {
  const zeroed =
    output.result.kind === "points"
      ? output.result.zeroReason !== null
      : output.evidence.zeroRuleIndex !== null;

  return {
    detail: `Zero: expected ${String(expected.zero)}, got ${String(zeroed)} (rule ${String(output.evidence.zeroRuleIndex)}).`,
    name: expected.zero ? "true-zero" : "false-zero",
    passed: zeroed === expected.zero,
  };
}

function feedbackChecks({
  expected,
  output,
}: {
  expected: GradeWritingExpected;
  output: GradeWritingOutput;
}): Check[] {
  const { criteria, nextStep } = output.result;
  const open = criteria.filter((criterion) => criterion.level !== "complete");

  const comments = [...criteria.map((criterion) => criterion.comment), nextStep?.text ?? ""].join(
    " ",
  );

  const language = detectLanguage(comments);
  const quoted = criteria.filter((criterion) => criterion.level !== "missing");

  const levels: Check[] = expected.minimumLevel
    ? [
        {
          detail: `Levels ${criteria.map((criterion) => `${criterion.id} ${criterion.level}`).join(", ")}; expected at least ${expected.minimumLevel}.`,
          name: "levels",
          passed: criteria.every(
            (criterion) =>
              LEVEL_RANK[criterion.level] >= LEVEL_RANK[expected.minimumLevel ?? "missing"],
          ),
        },
      ]
    : [];

  return [
    ...levels,
    {
      detail: nextStep
        ? `Next step on ${nextStep.criterionId}${expected.nextStepCriteria ? `, expected one of ${expected.nextStepCriteria.join(", ")}` : ""}.`
        : `No next step, ${open.length} criteria open.`,
      name: "next-step",
      passed: nextStep
        ? !expected.nextStepCriteria || expected.nextStepCriteria.includes(nextStep.criterionId)
        : open.length === 0 || expected.zero,
    },
    {
      detail: `Feedback language: expected ${expected.feedbackLanguage}, detected ${language ?? "unknown"}.`,
      name: "language",
      passed: language === expected.feedbackLanguage,
    },
    {
      detail: `${quoted.filter((criterion) => criterion.quote).length} of ${quoted.length} assessed criteria quote the answer exactly.`,
      name: "quotes",
      passed:
        quoted.filter((criterion) => criterion.quote).length >= quoted.length * MIN_QUOTED_SHARE,
    },
  ];
}

export const scoreWritingGrade: TaskScorer<GradeWritingExpected> = ({ output, testCase }) => {
  const { expected } = testCase;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} has no expected grade.`);
  }

  const input = testCase.userInput as GradeWritingInput;
  const graded = JSON.parse(output) as GradeWritingOutput;
  const text = input.text.slice(0, graded.result.ignoredFrom ?? input.text.length);
  const truth = input.arithmetic ? truthSide({ expected, input, output: graded }) : null;
  const predicted = predictedSide({ input, output: graded });

  const side: Check[] =
    truth && truth !== "uncertain"
      ? [
          {
            detail: `Pass side: standard ${truth}, grade ${predicted ?? "levels"}${graded.result.kind === "points" ? ` (${graded.result.total.low}–${graded.result.total.high} of ${graded.result.max})` : ""}.`,
            name: "pass-side",
            passed: predicted !== (truth === "pass" ? "fail" : "pass"),
          },
        ]
      : [];

  const checks = [
    ...errorChecks({ expected, output: graded, planted: input.arithmetic !== null, text }),
    zeroCheck({ expected, output: graded }),
    ...creditChecks({ expected, input, output: graded, text }),
    ...side,
    ...feedbackChecks({ expected, output: graded }),
  ];

  const failed = checks.filter((check) => !check.passed);

  return {
    ...createFixedScore({
      conclusion:
        failed.length === 0
          ? `All ${checks.length} checks passed. ${checks.map((check) => check.detail).join(" ")}`
          : failed.map((check) => `[${check.name}] ${check.detail}`).join(" "),
      score:
        Math.round(
          (MIN_SCORE + (SCORE_RANGE * (checks.length - failed.length)) / checks.length) * 100,
        ) / 100,
    }),
    ...(truth && predicted ? { classification: { expected: truth, predicted } } : {}),
  };
};
