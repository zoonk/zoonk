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

const FAILURE_LABELS: Record<string, string> = {
  "Missed the control bank defect.": "missed the planted mistake",
  "Missing or repeated pair.": "skipped or repeated a pair",
  "Preferred one of two identical outputs.": "preferred one of two identical answers",
  "Unexpected verdict count.": "answered the wrong number of pairs",
  "Verdict does not cover the sealed criteria or outputs.": "left a point or an answer out",
};

const FAILURE_ADVICE: Record<string, string> = {
  "Missed the control bank defect.":
    "one pair has a planted mistake: prefer the answer without it and add the mistake as a major problem on the point it breaks",
  "Preferred one of two identical outputs.":
    "one pair shows the same answer twice, so it takes Tie overall and on every point",
};

/** A reader's failed check in a few words. */
export function failureLabel(failure: string): string {
  return FAILURE_LABELS[failure] ?? failure;
}

/** What the owner changes so their read counts. */
export function failureAdvice(failure: string): string {
  return FAILURE_ADVICE[failure] ?? failureLabel(failure);
}
