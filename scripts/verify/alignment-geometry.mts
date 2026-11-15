/* oxlint-disable no-magic-numbers -- Tolerances in logical units, as `REPORT-SHAPE.md` states them. */
import {
  type AlignmentFinding,
  type Bounds,
  type Capture,
  type CaptureElement,
  type NotMeasured,
  configurationName,
} from "./alignment-capture.mts";
import { PART_NAMES } from "./alignment-table.mts";

export const EDGE = 1;

export type Box = { bottom: number; left: number; right: number; top: number };

export function box([x, y, width, height]: Bounds): Box {
  return { bottom: y + height, left: x, right: x + width, top: y };
}

/**
 * A number from the capture, for arithmetic: what was measured, its `fallback` when the capture
 * gives none, or null when it says it wasn't measured, for which the caller writes a failing
 * not-measured record. "not measured" never enters arithmetic, where NaN would pass every tolerance.
 */
export function measured(
  value: number | NotMeasured | undefined,
  fallback: number | null = null,
): number | null {
  return value === "not measured" ? null : (value ?? fallback);
}

export function drawn(element: CaptureElement): Box | null {
  return Array.isArray(element.ink) ? box(element.ink) : null;
}

/** For printing a position: comparisons use what was measured. */
export function tenths(value: number) {
  return Math.round(value * 10) / 10;
}

/** A finding's size, fine enough that a miss just past a 1-unit tolerance doesn't print as 1. */
function hundredths(value: number) {
  return Math.round(value * 100) / 100;
}

export type Context = { capture: Capture; unit: string };

export function finding(
  { capture, unit }: Context,
  fields: Omit<AlignmentFinding, "configuration" | "scenario" | "screen" | "unit">,
): AlignmentFinding {
  return {
    ...fields,
    configuration: configurationName(capture.configuration),
    scenario: capture.scenario,
    screen: capture.screen,
    unit,
    ...(fields.measured === undefined ? {} : { measured: hundredths(fields.measured) }),
  };
}

export function holderNamed(holders: CaptureElement[], region: Box): string | undefined {
  const inside = holders.filter((holder) => {
    const at = box(holder.bounds);

    return (
      at.left >= region.left - EDGE &&
      at.right <= region.right + EDGE &&
      at.top >= region.top - EDGE &&
      at.bottom <= region.bottom + EDGE
    );
  });

  const largest = inside.toSorted(
    (one, other) => other.bounds[2] * other.bounds[3] - one.bounds[2] * one.bounds[3],
  )[0];

  return largest
    ? `${largest.name ?? "an element"} (${tenths(largest.bounds[2])}×${tenths(largest.bounds[3])}) draws nothing and holds that room`
    : undefined;
}

export type Group = {
  group: CaptureElement;
  rows: CaptureElement[];
  parts: CaptureElement[];
  holders: CaptureElement[];
  /** Areas the platform couldn't read (`"part": "unmeasured"`). */
  unreadable: CaptureElement[];
};

const PARTS = new Set<string>(PART_NAMES);

function mirrorBounds([x, y, width, height]: Bounds): Bounds {
  return [-(x + width), y, width, height];
}

/**
 * A right-to-left group, mirrored so its start is on the left like every other: one set of rules
 * reads both directions. Positions in its findings are mirrored too; distances are not.
 */
function mirrored(element: CaptureElement): CaptureElement {
  const endEdge = measured(element.endEdge);

  return {
    ...element,
    bounds: mirrorBounds(element.bounds),
    ...(Array.isArray(element.ink) ? { ink: mirrorBounds(element.ink) } : {}),
    ...(element.firstLine ? { firstLine: mirrorBounds(element.firstLine) } : {}),
    ...(endEdge === null ? {} : { endEdge: -endEdge }),
  };
}

export function groupsOf(capture: Capture): Group[] {
  const byGroup = Map.groupBy(
    capture.elements.filter((element) => element.group !== null),
    (element) => element.group ?? "",
  );

  return capture.elements
    .filter((element) => element.part === "group")
    .map((declared) => {
      const flip = declared.direction === "rtl" ? mirrored : (element: CaptureElement) => element;
      const inside = (byGroup.get(declared.id) ?? []).map((element) => flip(element));

      return {
        group: flip(declared),
        holders: inside.filter((element) => element.part === "holder"),
        parts: inside.filter((element) => PARTS.has(element.part)),
        rows: inside
          .filter((element) => element.part === "row")
          .toSorted((one, other) => one.bounds[1] - other.bounds[1]),
        unreadable: inside.filter((element) => element.part === "unmeasured"),
      };
    });
}

/** A row by its name, or its first label's words where a platform names rows by their parts. */
export function rowName({ parts, rows }: Group, id: string | null): string {
  const row = rows.find((candidate) => candidate.id === id);
  const self = parts.find((element) => element.id === id);

  const label =
    parts.find((element) => element.row === id && element.part === "label") ??
    parts.find((element) => element.row === id && element.text);

  const text = self?.text ?? label?.text;
  return row?.name ?? self?.name ?? (text ? `"${text}"` : (id ?? ""));
}

/** A group by its name, or its first row's, so one fault reads the same on every capture. */
export function groupName(group: Group): string {
  return `${group.group.piece} ${group.group.name ?? rowName(group, group.rows[0]?.id ?? null)}`;
}

/**
 * What a declared piece promised and the read couldn't measure. An unmeasured relationship is
 * never a pass: each gap in the inputs is a not-measured record, and it fails the run like a
 * broken relationship, since the piece's declaration says these parts are there.
 */
export function notMeasured(
  context: Context,
  read: Group,
  rule: string,
  what: string,
  detail: string,
) {
  // One reason is one line however many groups show it (a sweep can show it on a hundred rows):
  // the group goes in the detail, under the reason.
  return finding(context, {
    detail: `${groupName(read)}: ${detail}`,
    level: "not-measured",
    message: `${read.group.piece}: ${what}`,
    piece: read.group.piece,
    rule,
  });
}
