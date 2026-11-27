import { createFixedScore } from "@/lib/score";
import { detectLanguage } from "@/lib/text-language";
import { type TaskScorer } from "@/lib/types";
import { countWritingLines } from "@zoonk/core/exams/essays/writing-lines";
import { markWritingRows } from "@zoonk/core/exams/essays/writing-marks";
import { type GradeWritingExpected, type GradeWritingInput } from "./cases/shared";
import { type GradeWritingOutput } from "./task";

const MIN_SCORE = 6;
const SCORE_RANGE = 4;

/** How far the content points may sit from the answer standard's, as a share of the maximum. */
const CONTENT_TOLERANCE = 0.1;
const MIN_QUOTED_SHARE = 0.6;
const LEVEL_RANK = { complete: 3, missing: 0, partial: 1, strong: 2 } as const;

type Check = { name: string; passed: boolean; detail: string };
type Side = "fail" | "pass" | "straddle";
type Range = { high: number; low: number };
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

function changedSpan({ correction, quote, start }: GradeWritingOutput["result"]["errors"][number]) {
  const prefix = quote.split("").findIndex((character, index) => character !== correction[index]);
  const unchangedStart = prefix === -1 ? quote.length : prefix;
  const suffixLimit = Math.min(quote.length, correction.length) - unchangedStart;

  const unchangedEnd = Array.from({ length: suffixLimit }, (_, index) => index + 1).findIndex(
    (distance) => quote.at(-distance) !== correction.at(-distance),
  );

  const end = quote.length - (unchangedEnd === -1 ? suffixLimit : unchangedEnd);

  // An insertion has no width in the source. The character beside it locates the change.
  const changeStart = end <= unchangedStart ? Math.max(0, unchangedStart - 1) : unchangedStart;
  return { end: start + Math.max(changeStart + 1, end), start: start + changeStart };
}

function compareErrors({
  expected,
  output,
  text,
}: {
  expected: GradeWritingExpected;
  output: GradeWritingOutput;
  text: string;
}) {
  const real = spansOf(text, expected.languageErrors ?? []);
  const traps = spansOf(text, expected.traps ?? []);
  const reported = output.result.errors.map((error) => ({ ...error, span: changedSpan(error) }));
  const matched = reported.map((error) => real.filter((span) => overlaps(error.span, [span])));
  const found = new Set(matched.flatMap((spans) => (spans.length === 1 ? spans : [])));
  const wrong = reported.filter((_, index) => matched[index]?.length !== 1);

  return {
    missed: real.filter((span) => !found.has(span)),
    real,
    trapped: wrong.filter((error) => overlaps(error.span, traps)),
    wrong,
  };
}

function errorChecks({
  errors,
  expected,
  reportedCount,
  text,
}: {
  errors: ReturnType<typeof compareErrors>;
  expected: GradeWritingExpected;
  reportedCount: number;
  text: string;
}): Check[] {
  const { missed, real, trapped, wrong } = errors;

  const describe = (entries: typeof wrong) =>
    entries
      .map(({ correction, quote, start }) => `"${quote}" → "${correction}" @ ${start}`)
      .join("; ");

  const missedText = missed.map(({ end, start }) => `"${text.slice(start, end)}" @ ${start}`);
  const recall = `Found ${real.length - missed.length}/${real.length} keyed error occurrences.`;

  return [
    ...(expected.languageErrors
      ? [
          {
            detail:
              wrong.length > 0
                ? `Unkeyed corrections: ${describe(wrong)}.`
                : "No unkeyed corrections.",
            name: "false-errors",
            passed: wrong.length === 0,
          },
        ]
      : []),
    ...(expected.officialErrorCount === undefined
      ? []
      : [
          {
            detail: `Found ${reportedCount} errors against the board's ${expected.officialErrorCount}.`,
            name: "error-count",
            passed: reportedCount === expected.officialErrorCount,
          },
        ]),
    {
      detail:
        trapped.length > 0
          ? `Accepted usage flagged: ${describe(trapped)}.`
          : "No accepted usage flagged.",
      name: "traps",
      passed: trapped.length === 0,
    },
    ...(real.length > 0
      ? [
          {
            detail: missed.length > 0 ? `${recall} Missed: ${missedText.join(", ")}.` : recall,
            name: "error-recall",
            passed: missed.length === 0,
          },
        ]
      : []),
  ];
}

/** Marked on the board's own scale, where aspects describe the answer and earn no points. */
function hasBoardScale({ basis }: GradeWritingInput) {
  return basis.grading.criteria.some(({ awards }) => awards);
}

/** Earned the way the arithmetic counts it: above its lowest award, with a quote found in the answer. */
function creditedAspects({
  input,
  output,
  text,
}: {
  input: GradeWritingInput;
  output: GradeWritingOutput;
  text: string;
}) {
  return new Set(
    markWritingRows({ basis: input.basis, eligible: text, evidence: output.evidence }).flatMap(
      ({ row, verified }) => (row.aspect !== undefined && verified ? [row.aspect] : []),
    ),
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
  const credited = creditedAspects({ input, output, text });
  const uncertain = new Set(expected.uncertain);
  const earned = new Set(expected.earned);

  const indexes = input.basis.aspects
    .map((_, index) => index)
    .filter((index) => !uncertain.has(index));

  const falseCredit = indexes.filter((index) => credited.has(index) && !earned.has(index));
  const missed = indexes.filter((index) => !credited.has(index) && earned.has(index));

  const detail = `Aspect agreement ${indexes.length - falseCredit.length - missed.length}/${indexes.length}. Credited ${[...credited].toSorted((a, b) => a - b).join(",") || "none"}; expected ${expected.earned.join(",") || "none"}${uncertain.size > 0 ? ` (either way: ${[...uncertain].join(",")})` : ""}. False credit: ${falseCredit.join(",") || "none"}; missed: ${missed.join(",") || "none"}.`;

  if (input.basis.points === null || !input.numeric || hasBoardScale(input)) {
    return [{ detail, name: "credit", passed: falseCredit.length + missed.length <= 1 }];
  }

  const value = (chosen: Iterable<number>) =>
    [...chosen].reduce((sum, index) => sum + (input.basis.aspects[index]?.points ?? 0), 0);

  const truth = {
    high: expected.officialContent ?? value([...earned, ...uncertain]),
    low: expected.officialContent ?? value(earned),
  };

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

function expectedScore({
  expected,
  input,
  errors,
}: {
  expected: GradeWritingExpected;
  input: GradeWritingInput;
  errors: number;
}): Range | null {
  if (!input.numeric) {
    return null;
  }

  if (expected.officialTotal !== undefined || expected.zero) {
    const total = expected.officialTotal ?? 0;
    return { high: total, low: total };
  }

  if (hasBoardScale(input)) {
    return null;
  }

  const { basis, text } = input;

  const { estimatedLines } = countWritingLines({
    charactersPerLine: basis.charactersPerLine,
    limit: basis.lines,
    text,
  });

  const lines = Math.max(1, Math.min(estimatedLines, basis.lines ?? estimatedLines));
  const language = basis.grading.language;

  const penalty =
    ((language?.factor ?? 0) * errors) / (language?.method === "errorsPerLine" ? lines : 1);

  const score = (indexes: number[]) => {
    const content = indexes.reduce((sum, index) => sum + (basis.aspects[index]?.points ?? 0), 0);
    return Math.max(0, Number(content.toPrecision(15)) - penalty);
  };

  return {
    high: score([...expected.earned, ...(expected.uncertain ?? [])]),
    low: score(expected.earned),
  };
}

function sideOf(range: Range, threshold: number): Side {
  if (range.low >= threshold) {
    return "pass";
  }

  return range.high < threshold ? "fail" : "straddle";
}

function comparePassSide({
  expected,
  truth,
  predicted,
}: {
  expected: GradeWritingExpected;
  truth: Range | null;
  predicted: Range | null;
}) {
  if (!expected.passBoundary || !truth) {
    return null;
  }

  const { otherAnswers, sectionMinimum } = expected.passBoundary;
  const threshold = Number((sectionMinimum - otherAnswers).toPrecision(15));

  return {
    expected: sideOf(truth, threshold),
    predicted: predicted ? sideOf(predicted, threshold) : null,
    threshold,
  };
}

function scoreCoverage({ truth, predicted }: { truth: Range; predicted: Range | null }) {
  if (!predicted) {
    return null;
  }

  const midpoint = (predicted.high + predicted.low) / 2;
  const overlapsTruth = predicted.low <= truth.high && predicted.high >= truth.low;
  const coversTruth = predicted.low <= truth.low && predicted.high >= truth.high;

  const status = overlapsTruth ? "overlaps" : "missed";

  return {
    midpointError:
      truth.high === truth.low
        ? Math.abs(midpoint - truth.low)
        : Math.max(0, truth.low - midpoint, midpoint - truth.high),
    status: coversTruth ? "covered" : status,
    width: predicted.high - predicted.low,
  };
}

function zeroCheck({
  expected,
  input,
  output,
}: {
  expected: GradeWritingExpected;
  input: GradeWritingInput;
  output: GradeWritingOutput;
}): Check[] {
  if (!input.numeric) {
    return [];
  }

  if (output.result.kind !== "points") {
    return [{ detail: "The arithmetic returned levels.", name: "numeric-result", passed: false }];
  }

  const reason = output.result.zeroReason;
  const rule = input.basis.grading.zeroing.find(({ text }) => text === reason);
  const blank = rule?.kinds?.includes("blank") && input.text.trim() === "";
  const detected = rule?.kinds?.includes("tooFewLines") ? "tooFewLines" : output.evidence.zeroKind;
  const kind = output.result.zeroKind ?? (blank ? "blank" : detected);
  const matchesKind = !expected.zeroKind || expected.zeroKind === kind;
  const quote = output.evidence.zeroQuote;

  return [
    {
      detail: `Zero: expected ${expected.zeroKind ?? String(expected.zero)}, got ${reason ?? "no zero"}${quote ? ` from "${quote}"` : ""}.`,
      name: expected.zero ? "true-zero" : "false-zero",
      passed: expected.zero === (reason !== null) && matchesKind,
    },
  ];
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

  const comments = [
    ...criteria.map((criterion) => criterion.comment),
    nextStep?.title ?? "",
    nextStep?.text ?? "",
  ].join(" ");

  const language = detectLanguage(comments);
  const quoted = criteria.filter((criterion) => criterion.level !== "missing");

  const stepCheck = {
    detail: nextStep
      ? `Next step on ${nextStep.criterionId}${expected.nextStepCriteria ? `, expected one of ${expected.nextStepCriteria.join(", ")}` : ""}.`
      : `No next step, ${open.length} criteria open.`,
    name: "next-step",
    passed: nextStep
      ? !expected.nextStepCriteria || expected.nextStepCriteria.includes(nextStep.criterionId)
      : open.length === 0 || expected.zero,
  };

  if (nextStep?.kind === "zero" || nextStep?.kind === "limit") {
    stepCheck.detail = `Next step addresses ${nextStep.kind === "zero" ? "a zeroing rule" : "the line limit"}.`;

    stepCheck.passed =
      nextStep.kind === "zero" ? expected.zero : output.result.ignoredFrom !== null;
  }

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
    stepCheck,
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

function competenceChecks({
  expected,
  result,
}: {
  expected: GradeWritingExpected;
  result: GradeWritingOutput["result"];
}): Check[] {
  return Object.entries(expected.officialCompetences ?? {}).map(([id, official]) => {
    const row = result.kind === "points" ? result.rows.find((entry) => entry.id === id) : null;
    const band = row?.range;

    return {
      detail: `${id}: published ${official}, ${band ? `range ${band.low}–${band.high}` : "no range"}.`,
      name: "competence",
      passed: Boolean(band && band.low <= official && band.high >= official),
    };
  });
}

function totalCheck({
  predicted,
  truth,
  range,
}: {
  predicted: Range | null;
  truth: Range;
  range: ReturnType<typeof scoreCoverage>;
}): Check {
  const shown = predicted ? `range ${predicted.low}–${predicted.high}` : "no range";

  const metrics = range
    ? `${range.status}, width ${range.width.toFixed(3)}, midpoint error ${range.midpointError.toFixed(3)}`
    : "unavailable";

  return {
    detail: `Key ${truth.low}–${truth.high}; ${shown}; ${metrics}.`,
    name: "range",
    passed: Boolean(range && range.status !== "missed"),
  };
}

function passCheck(pass: NonNullable<ReturnType<typeof comparePassSide>>): Check {
  const opposite = pass.expected === "pass" ? "fail" : "pass";

  return {
    detail: `Pass side at ${pass.threshold} for this answer: key ${pass.expected}, range ${pass.predicted ?? "unavailable"}.`,
    name: "pass-side",
    passed:
      pass.predicted !== null && (pass.expected === "straddle" || pass.predicted !== opposite),
  };
}

function assessWritingGrade({
  expected,
  input,
  output,
}: {
  expected: GradeWritingExpected;
  input: GradeWritingInput;
  output: GradeWritingOutput;
}) {
  const { result } = output;
  const text = input.text.slice(0, result.ignoredFrom ?? input.text.length);
  const errors = compareErrors({ expected, output, text });

  const truth = expectedScore({
    errors: expected.officialErrorCount ?? errors.real.length,
    expected,
    input,
  });

  const predicted = result.kind === "points" ? result.total : null;
  const pass = comparePassSide({ expected, predicted, truth });
  const range = truth && scoreCoverage({ predicted, truth });
  const zero = zeroCheck({ expected, input, output });

  const checks = [
    ...errorChecks({ errors, expected, reportedCount: result.errors.length, text }),
    ...zero,
    ...creditChecks({ expected, input, output, text }),
    ...feedbackChecks({ expected, output }),
    ...competenceChecks({ expected, result }),
    ...(pass ? [passCheck(pass)] : []),
    ...(truth ? [totalCheck({ predicted, range, truth })] : []),
  ];

  return { checks, pass };
}

export const scoreWritingGrade: TaskScorer<GradeWritingExpected> = ({ output, testCase }) => {
  const { expected } = testCase;

  if (!expected) {
    throw new Error(`Test case ${testCase.id} has no expected grade.`);
  }

  const { checks, pass } = assessWritingGrade({
    expected,
    input: testCase.userInput as GradeWritingInput,
    output: JSON.parse(output) as GradeWritingOutput,
  });

  const failed = checks.filter((check) => !check.passed);

  return {
    ...createFixedScore({
      conclusion: checks
        .map((check) => `[${check.name}${check.passed ? "" : " FAIL"}] ${check.detail}`)
        .join(" "),
      score:
        Math.round(
          (MIN_SCORE + (SCORE_RANGE * (checks.length - failed.length)) / checks.length) * 100,
        ) / 100,
    }),
    ...(pass ? { classification: { expected: pass.expected, predicted: pass.predicted } } : {}),
  };
};
