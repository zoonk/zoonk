const PROGRAM_LINE = /File "main\.py", line (?<line>\d+)/gu;

/**
 * The part of a Python traceback a learner needs: the error on its last line and the line of
 * their program it points to. Frames from Pyodide's own runner are left out.
 */
export function parsePythonError(traceback: string): { line: number | null; message: string } {
  const lines = traceback.trimEnd().split("\n");
  const message = lines.at(-1)?.trim() ?? traceback;
  const programLine = [...traceback.matchAll(PROGRAM_LINE)].at(-1)?.groups?.line;

  return { line: programLine ? Number(programLine) : null, message };
}
