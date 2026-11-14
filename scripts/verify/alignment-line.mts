/* oxlint-disable no-magic-numbers -- The tolerance `ROW-LINE.md` proposes, in logical units. */
import { type AlignmentFinding, type CaptureElement } from "./alignment-capture.mts";
import { isStacked } from "./alignment-edges.mts";
import {
  type Context,
  type Group,
  drawn,
  finding,
  groupName,
  rowName,
} from "./alignment-geometry.mts";

/**
 * One line of a row (`ROW-LINE.md`, craft E6): every part sits on the middle of the label's
 * capitals, whatever its face or size. The tolerance (0.5, between what nobody saw and what the
 * owner saw) is pending: a one-line `ListRow` puts its chevron and mark 0.55 to 0.65 below its
 * label's capitals, and the owner is deciding whether the row moves or the tolerance does. Until
 * then the misses print as "not measured" with their numbers, and nothing fails.
 */
const LINE = 0.5;

/** A text's middle from the font's cap height, never from the string's ink: "yes" sits where "Off" would. */
function capMiddle(element: CaptureElement): number | null {
  const { capBottom, capTop } = element;

  return typeof capTop === "number" && typeof capBottom === "number"
    ? (capTop + capBottom) / 2
    : null;
}

function middleOf(element: CaptureElement): number | null {
  if (element.part !== "mark" && element.part !== "end") {
    return capMiddle(element);
  }

  const ink = drawn(element);
  return ink ? (ink.top + ink.bottom) / 2 : null;
}

type Miss = { off: number; part: string; to: string };

/**
 * Each part's distance from where it belongs (craft E5 and E6). One line: on the label's middle.
 * Beside a title and one description, or a title that wraps: a mark, a value and an end glyph on
 * the row's center. Beside three lines or more (a title and two descriptions): a mark on the
 * label's first line, a value and an end glyph on the row's center. A text lead always goes with
 * the label's first line. A value stacked under its label has no line to share.
 */
function misses(row: CaptureElement, own: CaptureElement[]): Miss[] | null {
  const label = own
    .filter((element) => element.part === "label" && drawn(element))
    .toSorted((one, other) => one.bounds[1] - other.bounds[1])[0];

  const stacked = isStacked(row, own);

  const others = own.filter(
    (element) =>
      ["end", "lead", "mark", "value"].includes(element.part) &&
      drawn(element) &&
      !(stacked && element.part === "value"),
  );

  if (!label || others.length === 0) {
    return [];
  }

  const labelMiddle = capMiddle(label);
  const middles = others.map((element) => ({ element, middle: middleOf(element) }));

  if (labelMiddle === null || middles.some(({ middle }) => middle === null)) {
    return null;
  }

  // A title counts as one line however it wraps; each description under it is another (E5).
  const notes = Math.max(own.filter((element) => element.part === "note").length, row.note ? 1 : 0);

  const oneLine = !stacked && (label.lines ?? 1) === 1 && notes === 0;
  const rowMiddle = row.middle ?? row.bounds[1] + row.bounds[3] / 2;
  const endMiddle = middles.find(({ element }) => element.part === "end")?.middle ?? null;

  return middles.flatMap(({ element, middle }): Miss[] => {
    const at = middle ?? labelMiddle;

    if (oneLine) {
      return [{ off: at - labelMiddle, part: element.part, to: "the label's middle" }];
    }

    // A text lead goes with the first line; a mark does beside three lines or more.
    if (element.part === "lead" || (element.part === "mark" && notes >= 2)) {
      return [{ off: at - labelMiddle, part: element.part, to: "the label's first line" }];
    }

    return [
      { off: at - rowMiddle, part: element.part, to: "the row's center" },
      ...(element.part === "value" && endMiddle !== null
        ? [{ off: at - endMiddle, part: "value", to: "the end glyph's middle" }]
        : []),
    ];
  });
}

function describe(miss: Miss) {
  return `the ${miss.part} ${Math.round(Math.abs(miss.off) * 100) / 100} ${miss.off > 0 ? "below" : "above"} ${miss.to}`;
}

export function lineLeads(context: Context, read: Group): AlignmentFinding[] {
  const { group, parts, rows } = read;

  return rows.flatMap((row) => {
    const own = parts.filter((element) => element.row === row.id);
    const found = misses(row, own);

    if (found === null) {
      return [
        finding(context, {
          detail: `${rowName(read, row.id)}: a part's first baseline or cap height wasn't measured`,
          level: "not-measured",
          message: `one line of a row in ${group.piece}: a part wasn't measured`,
          piece: group.piece,
          rule: "line",
        }),
      ];
    }

    const off = found.filter((miss) => Math.abs(miss.off) > LINE);

    if (off.length === 0) {
      return [];
    }

    return [
      finding(context, {
        detail: `${rowName(read, row.id)}: ${off.map((miss) => describe(miss)).join("; ")}`,
        level: "not-measured",
        measured: Math.max(...off.map((miss) => Math.abs(miss.off))),
        message: `a row of ${groupName(read)} is off one line by more than ${LINE} (tolerance pending)`,
        pending: true,
        piece: group.piece,
        rule: "line",
      }),
    ];
  });
}
