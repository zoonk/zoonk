/* oxlint-disable no-magic-numbers -- Tolerances in logical units, as `REPORT-SHAPE.md` states them. */
import {
  type AlignmentFinding,
  type Bounds,
  type Capture,
  type CaptureElement,
  configurationName,
} from "./alignment-capture.mts";

export const EDGE = 1;

export type Box = { bottom: number; left: number; right: number; top: number };

export function box([x, y, width, height]: Bounds): Box {
  return { bottom: y + height, left: x, right: x + width, top: y };
}

export function drawn(element: CaptureElement): Box | null {
  return Array.isArray(element.ink) ? box(element.ink) : null;
}

export function tenths(value: number) {
  return Math.round(value * 10) / 10;
}

export function overlapsVertically(one: Box, other: Box) {
  return Math.min(one.bottom, other.bottom) - Math.max(one.top, other.top) > 0;
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
    ...(fields.measured === undefined ? {} : { measured: tenths(fields.measured) }),
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
};

export function groupsOf(capture: Capture): Group[] {
  const byGroup = Map.groupBy(
    capture.elements.filter((element) => element.group !== null),
    (element) => element.group ?? "",
  );

  return capture.elements
    .filter((element) => element.part === "group")
    .map((group) => {
      const inside = byGroup.get(group.id) ?? [];

      return {
        group,
        holders: inside.filter((element) => element.part === "holder"),
        parts: inside.filter(
          (element) => !["group", "holder", "row", "action"].includes(element.part),
        ),
        rows: inside
          .filter((element) => element.part === "row")
          .toSorted((one, other) => one.bounds[1] - other.bounds[1]),
      };
    });
}

export function groupName(group: CaptureElement) {
  return `${group.piece} ${group.name ?? group.id}`;
}

export function rowName(rows: CaptureElement[], id: string | null) {
  return rows.find((row) => row.id === id)?.name ?? id ?? "";
}
