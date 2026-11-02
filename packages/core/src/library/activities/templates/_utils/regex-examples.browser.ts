export type RegexExamples = { shouldMatch: readonly string[]; shouldNotMatch: readonly string[] };

export function runRegexExamples(regex: RegExp, examples: RegexExamples): boolean {
  return (
    examples.shouldMatch.every((sample) => regex.test(sample)) &&
    !examples.shouldNotMatch.some((sample) => regex.test(sample))
  );
}
