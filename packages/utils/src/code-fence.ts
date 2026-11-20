/**
 * A CommonMark fenced code block written with backticks. The opening fence's info string can't
 * hold a backtick, so "```x```" stays inline code.
 */
const OPENING_FENCE = /^ {0,3}(?<ticks>`{3,})(?<info>[^`]*)$/u;
const CLOSING_FENCE = /^ {0,3}(?<ticks>`{3,}) *$/u;

/** `end` is the line after the closing fence; a fence that never closes runs to the text's end. */
export type CodeFence = { closed: boolean; code: string; end: number; language: string | null };

function readLanguage(info: string): string | null {
  return info.trim().split(/\s/u)[0]?.toLowerCase() || null;
}

function findClose({
  from,
  lines,
  ticks,
}: {
  from: number;
  lines: readonly string[];
  ticks: number;
}): number | null {
  const close = lines.findIndex(
    (line, index) =>
      index >= from && (CLOSING_FENCE.exec(line)?.groups?.ticks?.length ?? 0) >= ticks,
  );

  return close === -1 ? null : close;
}

/** Code lines stay exactly as written. */
export function readCodeFence(lines: readonly string[], index: number): CodeFence | null {
  const { info = "", ticks } = OPENING_FENCE.exec(lines[index] ?? "")?.groups ?? {};

  if (!ticks) {
    return null;
  }

  const close = findClose({ from: index + 1, lines, ticks: ticks.length });

  return {
    closed: close !== null,
    code: lines.slice(index + 1, close ?? lines.length).join("\n"),
    end: close === null ? lines.length : close + 1,
    language: readLanguage(info),
  };
}

/** A text that is one closed code block and nothing else, such as an answer option that is code. */
export function readWholeCodeFence(text: string): CodeFence | null {
  const lines = text.trim().split(/\r?\n/u);
  const fence = readCodeFence(lines, 0);

  return fence?.closed && fence.end === lines.length ? fence : null;
}

/** Every fence in order, with `start` at its opening line. */
export function findCodeFences(lines: readonly string[]): (CodeFence & { start: number })[] {
  return lines.reduce<(CodeFence & { start: number })[]>((found, _, index) => {
    if (index < (found.at(-1)?.end ?? 0)) {
      return found;
    }

    const fence = readCodeFence(lines, index);

    if (fence) {
      found.push({ ...fence, start: index });
    }

    return found;
  }, []);
}

/** Every line a fence covers, its fences included: players show them as code and parse nothing in them. */
export function findCodeFenceLines(lines: readonly string[]): ReadonlySet<number> {
  return new Set(
    findCodeFences(lines).flatMap(({ end, start }) =>
      Array.from({ length: end - start }, (_, offset) => start + offset),
    ),
  );
}

/** The text a learner reads as prose, for checks that would misread code. */
export function removeCodeFences(text: string): string {
  const lines = text.split(/\r?\n/u);
  const code = findCodeFenceLines(lines);

  return lines.filter((_, index) => !code.has(index)).join("\n");
}
