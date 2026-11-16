import { type AlignmentFinding, type CaptureElement } from "./alignment-capture.mts";
import {
  type Context,
  type Group,
  drawn,
  finding,
  measured,
  notMeasured,
  rowName,
  tenths,
} from "./alignment-geometry.mts";

/** A text's font size, where its type token names one ("Geist 14px 500 20px", "Geist 14 500 20"). */
function fontSize(element: CaptureElement): number | null {
  const size = /^.+ (?<size>\d+(?:\.\d+)?)(?:px)? \S+ \S+$/u.exec(element.type ?? "")?.groups?.size;
  return size === undefined ? null : Number(size);
}

/** How tall a text's capitals are: its size as a reader sees it, where a token names a role. */
function capHeight(element: CaptureElement): number | null {
  const top = measured(element.capTop);
  const bottom = measured(element.capBottom);
  return top === null || bottom === null ? null : bottom - top;
}

/** Two texts' sizes measured alike: their font sizes, or else their capitals. */
function sizes(one: CaptureElement, other: CaptureElement): [number, number] | null {
  const fonts = [fontSize(one), fontSize(other)];
  const caps = [capHeight(one), capHeight(other)];

  for (const [first, second] of [fonts, caps]) {
    if (first !== null && first !== undefined && second !== null && second !== undefined) {
      return [first, second];
    }
  }

  return null;
}

/** A helper's text is smaller than its title in the same group (C-A06, C-N10). */
export function helperLeads(context: Context, read: Group): AlignmentFinding[] {
  return read.rows.flatMap((row) => {
    const own = read.parts.filter((part) => part.row === row.id && drawn(part));
    const title = own.find((part) => part.part === "label");
    const helpers = own.filter((part) => part.part === "note");

    if (!title || helpers.length === 0) {
      return [];
    }

    const measures = helpers.map((helper) => ({ helper, measure: sizes(title, helper) }));

    if (measures.some(({ measure }) => measure === null)) {
      return [
        notMeasured(
          context,
          read,
          "helper",
          "a title's or its helper's size wasn't measured",
          rowName(read, row.id),
        ),
      ];
    }

    return measures.flatMap(({ helper, measure }) => {
      const [size = 0, helped = 0] = measure ?? [];

      return tenths(helped) >= tenths(size)
        ? [
            finding(context, {
              detail: `${rowName(read, row.id)}: its helper "${helper.text ?? helper.id}" is ${tenths(helped)} tall, its title ${tenths(size)}`,
              level: "fail",
              measured: helped - size,
              message: `a helper in ${read.group.piece} is as large as its title or larger`,
              piece: read.group.piece,
              rule: "helper",
            }),
          ]
        : [];
    });
  });
}
