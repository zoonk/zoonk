const MAX_CHANGED_LINES = 40;
const MAX_EXCERPT_LENGTH = 4000;

function toLines(text: string | null): string[] {
  return (text ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function missingFrom({ lines, other }: { lines: string[]; other: Set<string> }): string[] {
  return lines.filter((line) => !other.has(line)).slice(0, MAX_CHANGED_LINES);
}

/**
 * A short excerpt of what changed between two versions of a source, so a model
 * can describe the change in one line without reading both documents. Lines
 * are compared as sets: a moved paragraph isn't a change learners care about.
 */
export function summarizeTextChange({
  current,
  previous,
}: {
  current: string | null;
  previous: string | null;
}): string | null {
  const currentLines = toLines(current);
  const previousLines = toLines(previous);
  const removed = missingFrom({ lines: previousLines, other: new Set(currentLines) });
  const added = missingFrom({ lines: currentLines, other: new Set(previousLines) });

  if (removed.length === 0 && added.length === 0) {
    return null;
  }

  return [...removed.map((line) => `- ${line}`), ...added.map((line) => `+ ${line}`)]
    .join("\n")
    .slice(0, MAX_EXCERPT_LENGTH);
}
