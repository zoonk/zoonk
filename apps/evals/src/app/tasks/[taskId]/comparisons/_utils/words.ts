import { type Attempt, type FailureCode } from "@/lib/comparisons/schemas";

export function plural(count: number, one: string, many = `${one}s`): string {
  return `${count} ${count === 1 ? one : many}`;
}

export function humanizeKey(key: string): string {
  const words = key
    .replaceAll(/(?<before>[a-z0-9])(?<after>[A-Z])/gu, "$<before> $<after>")
    .replaceAll(/[_-]+/gu, " ")
    .toLowerCase()
    .trim();

  return words.charAt(0).toUpperCase() + words.slice(1);
}

const FAILURE_LABELS: Record<FailureCode, string> = {
  failed_controls: "failed a hidden check",
  invalid_response: "answered in the wrong shape",
  missing_verdicts: "skipped or repeated a pair",
};

/** Why a reader's read didn't count, in a few words; older reads carry only the engine's sentence. */
export function failureLabels(attempt: Pick<Attempt, "failureCodes" | "failures">): string[] {
  const labels = attempt.failureCodes?.map((code) => FAILURE_LABELS[code]) ?? attempt.failures;
  return [...new Set(labels)];
}
