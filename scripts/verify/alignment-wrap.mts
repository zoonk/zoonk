import { type AlignmentFinding, type CaptureElement } from "./alignment-capture.mts";
import { type Context, finding } from "./alignment-geometry.mts";

/** A separator between two items: a middle dot, a bullet, a spaced dash, a slash or a bar. */
const SEPARATORS = new Set(["·", "•", "-", "–", "—", "/", "|"]);

/** A last line of one word this short reads as left behind (WHY-MISSED.md, class M). */
const LONE_WORD = 8;

/** A word has a letter or a digit, so a dot, a dash or an arrow between words isn't one. */
function wordsOf(line: string) {
  return line.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word));
}

function texts(context: Context): CaptureElement[] {
  return context.capture.elements.filter((element) => element.part === "text" && element.lineTexts);
}

/** A line never ends with a separator (C-W04: a facts line that wraps after its middle dot). */
export function lineEndLeads(context: Context): AlignmentFinding[] {
  return texts(context).flatMap((text) => {
    const ends = (text.lineTexts ?? []).flatMap((line, index) => {
      const last = line.trim().split(/\s+/u).at(-1) ?? "";
      return SEPARATORS.has(last) ? [`line ${index + 1} ends with "${last}"`] : [];
    });

    return ends.length > 0
      ? [
          finding(context, {
            detail: `${text.name ?? text.id}: ${ends.join("; ")}`,
            level: "fail",
            measured: ends.length,
            message: "a line ends with a separator",
            piece: "page",
            rule: "line-end",
          }),
        ]
      : [];
  });
}

/** A wrapped title, facts line or button label never leaves one short word alone on its last line. */
export function loneWordLeads(context: Context): AlignmentFinding[] {
  return texts(context).flatMap((text) => {
    const lines = text.lineTexts ?? [];
    const last = wordsOf(lines.at(-1) ?? "");
    const word = last[0] ?? "";

    if (
      !text.textRole ||
      lines.length < 2 ||
      last.length !== 1 ||
      // oxlint-disable-next-line no-misused-spread -- The rule counts Unicode code points in a word, not graphemes.
      [...word.replaceAll(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "")].length > LONE_WORD
    ) {
      return [];
    }

    return [
      finding(context, {
        detail: `${text.name ?? text.id}: "${word}" alone on its last line`,
        level: "fail",
        message: `a wrapped ${text.textRole === "facts" ? "facts line" : text.textRole} leaves one short word alone`,
        piece: "page",
        rule: "lone-word",
      }),
    ];
  });
}
