/** Program output compares without trailing spaces or newlines, which learners can't see. */
export function normalizeProgramOutput(output: string): string {
  return output.replaceAll(/[\t ]+$/gmu, "").trim();
}
