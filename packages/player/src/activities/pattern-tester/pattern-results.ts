import { type ActivityFormulaExample } from "@zoonk/core/library/activities/expected-answer";
import { evaluateFormula } from "@zoonk/core/library/activities/expression/evaluate";
import {
  compileSafeRegex,
  formulaPassesExamples,
} from "@zoonk/core/library/activities/pattern-checks";

type Tolerance = Parameters<typeof formulaPassesExamples>[1]["tolerance"];

export type SampleResult = {
  match: { end: number; start: number } | null;
  passes: boolean;
  sample: string;
};

type RegexResults =
  | { status: "empty" | "invalid" }
  | { shouldMatch: SampleResult[]; shouldNotMatch: SampleResult[]; status: "tested" };

function testSample(regex: RegExp, sample: string, shouldMatch: boolean): SampleResult {
  const found = regex.exec(sample);
  const match = found ? { end: found.index + found[0].length, start: found.index } : null;
  return { match, passes: shouldMatch ? found !== null : found === null, sample };
}

export function testRegex(
  pattern: string,
  samples: { shouldMatch: readonly string[]; shouldNotMatch: readonly string[] },
): RegexResults {
  if (pattern.length === 0) {
    return { status: "empty" };
  }

  const regex = compileSafeRegex(pattern);

  if (!regex) {
    return { status: "invalid" };
  }

  return {
    shouldMatch: samples.shouldMatch.map((sample) => testSample(regex, sample, true)),
    shouldNotMatch: samples.shouldNotMatch.map((sample) => testSample(regex, sample, false)),
    status: "tested",
  };
}

export type FormulaResult = { expected: number; passes: boolean; value: number | null };

export function testFormula(
  formula: string,
  { examples, tolerance }: { examples: readonly ActivityFormulaExample[]; tolerance: Tolerance },
): FormulaResult[] {
  const source = formula.trim().replace(/^=/u, "");

  return examples.map((example) => {
    const evaluated = source ? evaluateFormula(source, example.inputs) : null;

    return {
      expected: example.output,
      passes:
        source.length > 0 && formulaPassesExamples(formula, { examples: [example], tolerance }),
      value: evaluated?.ok ? evaluated.value : null,
    };
  });
}

export function countPassing(results: readonly { passes: boolean }[]): number {
  return results.filter((result) => result.passes).length;
}
