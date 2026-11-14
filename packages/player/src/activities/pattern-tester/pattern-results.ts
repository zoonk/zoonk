import { type ActivityFormulaExample } from "@zoonk/core/library/activities/expected-answer";
import { evaluateFormula } from "@zoonk/core/library/activities/expression/evaluate";
import {
  compileSafeRegex,
  formulaPassesExamples,
} from "@zoonk/core/library/activities/pattern-checks";
import { type SampleMatch, runInSandbox } from "../_sandbox/sandbox-host";

type Tolerance = Parameters<typeof formulaPassesExamples>[1]["tolerance"];

export type SampleResult = { match: SampleMatch; passes: boolean; sample: string };

export type RegexResults =
  | { status: "empty" | "invalid" | "unavailable" }
  | { shouldMatch: SampleResult[]; shouldNotMatch: SampleResult[]; status: "tested" };

/** A pattern still running at the sandbox's time limit reads as invalid, as it fails grading. */
export async function testRegex(
  pattern: string,
  samples: { shouldMatch: readonly string[]; shouldNotMatch: readonly string[] },
): Promise<RegexResults> {
  if (pattern.length === 0) {
    return { status: "empty" };
  }

  const regex = compileSafeRegex(pattern);

  if (!regex) {
    return { status: "invalid" };
  }

  const all = [...samples.shouldMatch, ...samples.shouldNotMatch];

  const outcome = await runInSandbox({
    kind: "regex",
    onMessage: () => true,
    payload: { flags: regex.flags, samples: all, source: regex.source },
  });

  if (outcome.status === "unavailable") {
    return outcome;
  }

  if (outcome.status !== "done") {
    return { status: "invalid" };
  }

  const results = all.map((sample, index) => {
    const match = outcome.matches?.[index] ?? null;
    const shouldMatch = index < samples.shouldMatch.length;
    return { match, passes: shouldMatch ? match !== null : match === null, sample };
  });

  return {
    shouldMatch: results.slice(0, samples.shouldMatch.length),
    shouldNotMatch: results.slice(samples.shouldMatch.length),
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
