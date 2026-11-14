/** A statement's answer is saved as `true` or `false`; any other format keeps its words as saved. */
export function readStatementAnswer({
  answer,
  format,
}: {
  answer: string;
  format: string | undefined;
}): boolean | null {
  if (format === "trueFalse" && (answer === "true" || answer === "false")) {
    return answer === "true";
  }

  return null;
}
