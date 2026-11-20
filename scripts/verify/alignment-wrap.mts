import { type AlignmentFinding, type CaptureElement } from "./alignment-capture.mts";
import { type Context, finding } from "./alignment-geometry.mts";

/** A separator between two items: a middle dot, a bullet, a spaced dash, a slash or a bar. */
const SEPARATORS = new Set(["·", "•", "-", "–", "—", "/", "|"]);

/** A word has a letter or a digit, so a dot, a dash or an arrow between words isn't one. */
function wordsOf(line: string) {
  return line.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word));
}

function texts(context: Context): CaptureElement[] {
  return context.capture.elements.filter((element) => element.part === "text" && element.lineTexts);
}

/** A line never ends with a separator. */
export function lineEndLeads(context: Context): AlignmentFinding[] {
  return texts(context).flatMap((text) => {
    if (!text.textRole || (text.lineTexts?.length ?? 0) < 2) {
      return [];
    }

    const ends = (text.lineTexts ?? []).flatMap((line, index) => {
      const last = line.trim().split(/\s+/u).at(-1) ?? "";

      return SEPARATORS.has(last) && wordsOf(line).length > 0
        ? [`line ${index + 1} ends with "${last}"`]
        : [];
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

/** A wrapped title, facts line or button label never leaves one word alone on its last line. */
export function loneWordLeads(context: Context): AlignmentFinding[] {
  return texts(context).flatMap((text) => {
    const lines = text.lineTexts ?? [];
    const last = wordsOf(lines.at(-1) ?? "");
    const word = last[0] ?? "";

    if (
      !text.textRole ||
      lines.length < 2 ||
      last.length !== 1 ||
      wordsOf(lines.slice(0, -1).at(-1) ?? "").length < 2
    ) {
      return [];
    }

    return [
      finding(context, {
        detail: `${text.name ?? text.id}: "${word}" alone on its last line`,
        level: "fail",
        message: `a wrapped ${text.textRole === "facts" ? "facts line" : text.textRole} leaves one word alone`,
        piece: "page",
        rule: "lone-word",
      }),
    ];
  });
}
