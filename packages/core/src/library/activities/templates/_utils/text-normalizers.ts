export function normalizeProgramOutput(output: string): string {
  return output.replaceAll(/[\t ]+$/gmu, "").trim();
}
