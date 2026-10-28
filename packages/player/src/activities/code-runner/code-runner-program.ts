import { normalizeProgramOutput } from "@zoonk/core/library/activities/text-normalizers";

type Mistake = { feedback: string; output: string };

export function sameOutput(first: string, second: string): boolean {
  return normalizeProgramOutput(first) === normalizeProgramOutput(second);
}

export function mistakeFor(output: string, mistakes: readonly Mistake[]): Mistake | null {
  return mistakes.find((mistake) => sameOutput(mistake.output, output)) ?? null;
}

export function programWithEdits(
  starterCode: string,
  edits: Readonly<Record<number, string>>,
): string {
  return starterCode
    .split("\n")
    .map((line, index) => edits[index + 1] ?? line)
    .join("\n");
}
