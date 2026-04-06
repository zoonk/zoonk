type AiVisualCodeOutput = {
  annotations: { lineContent: string; text: string }[] | null;
  code: string;
  language: string;
};

type VisualCodeOutput = {
  annotations: { line: number; text: string }[] | null;
  code: string;
  language: string;
};

/**
 * Model annotations are more reliable when they point to a snippet of
 * code instead of an absolute line number, because models frequently
 * miscount their own output. This resolver translates that snippet back
 * into a stable 1-based line number so the player can highlight the
 * intended line without trusting the model's counting.
 */
function resolveLineNumber({ code, lineContent }: { code: string; lineContent: string }): number {
  const lines = code.split("\n");
  const exactIndex = lines.indexOf(lineContent);

  if (exactIndex !== -1) {
    return exactIndex + 1;
  }

  const trimmedLineContent = lineContent.trim();
  const substringIndex = lines.findIndex((line) => line.trim().includes(trimmedLineContent));

  if (substringIndex !== -1) {
    return substringIndex + 1;
  }

  return 1;
}

/**
 * The public code visual schema needs real line numbers, but the model
 * is asked for line snippets because that is what it can identify
 * consistently. This builder is the translation layer between those two
 * shapes, keeping the task itself free from mapping details.
 */
export function buildVisualCodeOutput({
  annotations,
  code,
  language,
}: AiVisualCodeOutput): VisualCodeOutput {
  return {
    annotations: annotations
      ? annotations.map((annotation) => ({
          line: resolveLineNumber({ code, lineContent: annotation.lineContent }),
          text: annotation.text,
        }))
      : null,
    code,
    language,
  };
}
