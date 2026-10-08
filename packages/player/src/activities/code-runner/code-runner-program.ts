import { normalizeProgramOutput } from "@zoonk/core/library/activities/text-normalizers";

type Mistake = { feedback: string; output: string };

/** Output compares the way grading compares it: trailing spaces and blank lines don't count. */
export function sameOutput(first: string, second: string): boolean {
  return normalizeProgramOutput(first) === normalizeProgramOutput(second);
}

/** The feedback written for the output a likely mistake prints, if this run printed it. */
export function mistakeFor(output: string, mistakes: readonly Mistake[]): Mistake | null {
  return mistakes.find((mistake) => sameOutput(mistake.output, output)) ?? null;
}

/** Replaces the learner's editable lines (1-based) in the starter code. */
export function programWithEdits(
  starterCode: string,
  edits: Readonly<Record<number, string>>,
): string {
  return starterCode
    .split("\n")
    .map((line, index) => edits[index + 1] ?? line)
    .join("\n");
}
