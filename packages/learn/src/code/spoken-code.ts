import { useExtracted } from "next-intl";

export type IndentRun = { count: number; kind: "space" | "tab" };

export type SpokenCodeLine = { code: string; indent: IndentRun[] };

const INDENTATION = /^[ \t]*/u;
const RUNS = / +|\t+/gu;

export function readCodeLine(line: string): SpokenCodeLine {
  const indentation = INDENTATION.exec(line)?.[0] ?? "";
  const code = line.slice(indentation.length).trimEnd();

  const indent = [...indentation.matchAll(RUNS)].map(([run]) => ({
    count: run.length,
    kind: run.startsWith("\t") ? "tab" : "space",
  })) satisfies IndentRun[];

  return { code, indent: code ? indent : [] };
}

/**
 * Code in words a screen reader keeps apart: a line's number and its indentation, which the eye
 * reads from where its code starts. Without them, a program whose `print` is indented under its
 * `for` and one where it isn't read the same.
 */
export function useSpokenCode() {
  const t = useExtracted();

  const indentWords = (indent: readonly IndentRun[]) =>
    indent
      .map(({ count, kind }) =>
        kind === "tab"
          ? t({
              description:
                "How far a line of a program is indented, read by screen readers, such as “Line 2, indented 1 tab: …”.",
              message: "{count, plural, one {# tab} other {# tabs}}",
              values: { count },
            })
          : t({
              description:
                "How far a line of a program is indented, read by screen readers, such as “Line 2, indented 4 spaces: …”.",
              message: "{count, plural, one {# space} other {# spaces}}",
              values: { count },
            }),
      )
      .join(", ");

  const line = (text: string, number: number): string => {
    const { code, indent } = readCodeLine(text);
    const at = String(number);

    if (!code) {
      return t({
        description: "Read by screen readers for an empty line of a program.",
        message: "Line {number}: blank",
        values: { number: at },
      });
    }

    return indent.length > 0
      ? t({
          description:
            "Read by screen readers for an indented line of a program: its number, how far it's indented (such as “4 spaces”), then its code as written.",
          message: "Line {number}, indented {indent}: {code}",
          values: { code, indent: indentWords(indent), number: at },
        })
      : t({
          description:
            "Read by screen readers for a line of a program: its number, then its code as written.",
          message: "Line {number}: {code}",
          values: { code, number: at },
        });
  };

  /** Code the learner presses, such as an answer option: one line reads as written. */
  const snippet = (code: string): string => {
    const lines = code.split(/\r?\n/u);
    const [only] = lines;

    if (lines.length > 1 || only === undefined) {
      return lines.map((text, index) => line(text, index + 1)).join(" ");
    }

    const { code: written, indent } = readCodeLine(only);

    return indent.length > 0
      ? t({
          description:
            "Read by screen readers for a one-line program that is indented: how far (such as “4 spaces”), then its code as written.",
          message: "Indented {indent}: {code}",
          values: { code: written, indent: indentWords(indent) },
        })
      : written;
  };

  return { line, snippet };
}
