const REQUIRED_ABC_HEADERS = ["X:", "M:", "L:", "K:"];

type VisualMusicOutput = {
  abc: string;
  description: string;
};

/**
 * Models sometimes double-escape line breaks inside the ABC string,
 * which turns a multi-line score into one literal `\n`-filled line.
 * ABC renderers expect real line breaks between headers and notes,
 * so this function decodes common escaped line-break sequences and
 * normalizes them into a consistent `\n` format.
 */
function normalizeAbcLineBreaks(abc: string): string {
  return abc
    .replaceAll(String.raw`\r\n`, "\n")
    .replaceAll(String.raw`\n`, "\n")
    .replaceAll(String.raw`\r`, "\n")
    .replaceAll("\r\n", "\n")
    .replaceAll("\r", "\n")
    .trim();
}

/**
 * ABC output is only usable if the required header block survives
 * generation. This check makes sure we still have the standard
 * `X:`, `M:`, `L:`, and `K:` lines after normalization, and that
 * there is at least one music line after the key signature.
 */
function assertValidAbcNotation(lines: string[]): void {
  const missingHeaders = REQUIRED_ABC_HEADERS.filter(
    (header) => !lines.some((line) => line.startsWith(header)),
  );

  if (missingHeaders.length > 0) {
    throw new Error(`Missing required ABC headers: ${missingHeaders.join(", ")}`);
  }

  const keySignatureIndex = lines.findIndex((line) => line.startsWith("K:"));

  if (keySignatureIndex === lines.length - 1) {
    throw new Error("ABC notation must include notes after the K: header");
  }
}

/**
 * The public music task should return normalized ABC data instead of
 * raw model text so downstream renderers receive a valid multi-line
 * notation string. This keeps the repair logic in one place and lets
 * the task fail fast when the model omits the required ABC structure.
 */
export function normalizeVisualMusicOutput({
  abc,
  description,
}: VisualMusicOutput): VisualMusicOutput {
  const lines = normalizeAbcLineBreaks(abc)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  assertValidAbcNotation(lines);

  return {
    abc: lines.join("\n"),
    description,
  };
}
