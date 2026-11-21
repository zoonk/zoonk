import { type PlotVisual } from "@zoonk/core/library/steps/contract";
import { type LinearScale } from "@zoonk/utils/plot-scale";
import { type TextWidth, getWidestWord, wrapLabel } from "./category-labels";
import { LABEL_GAP, LABEL_LINE_HEIGHT, PADDING } from "./chart-layout";
import { DOT_RADIUS, type KeyEntry } from "./point-labels";

/** The narrowest plot area that still keeps its x numbers and its points' names readable. */
export const MIN_PLOT_WIDTH = 72;
export const MAX_GUTTER_SHARE = 0.3;
export const REFERENCE_INSET = DOT_RADIUS + LABEL_GAP;
const REFERENCE_SPACING = 2;
const MAX_NAME_SHIFT = LABEL_LINE_HEIGHT / 2;

export type Measure = { labelWidth: (text: string) => number; textWidth: TextWidth };

/** `top` is the first line's top and `x` where the text starts; a numbered line's name is in the key. */
export type ReferenceMark = { label: string; lines: string[]; top: number; x: number; y: number };

export type PlannedMark = Omit<ReferenceMark, "x"> & { offset: number };

type ReferencePlan = { key: KeyEntry[]; marks: PlannedMark[]; width: number };

function blockHeight(mark: { lines: string[] }): number {
  return mark.lines.length * LABEL_LINE_HEIGHT;
}

function stackReferences({ bottom, marks }: { bottom: number; marks: PlannedMark[] }) {
  const stacked: PlannedMark[] = [];

  for (const mark of marks.toSorted((a, b) => a.y - b.y)) {
    const previous = stacked.at(-1);
    const floor = previous ? previous.top + blockHeight(previous) + REFERENCE_SPACING : 0;
    stacked.push({ ...mark, top: Math.max(mark.top, floor) });
  }

  const last = stacked.at(-1);
  const overflow = last ? last.top + blockHeight(last) - bottom : 0;

  return overflow > 0 ? stacked.map((mark) => ({ ...mark, top: mark.top - overflow })) : stacked;
}

/**
 * Names sit past the plot's right edge, level with their lines and clear of a point drawn on that
 * edge. A name wraps to a share of the width, never inside a word and never taking the plot below
 * its narrowest; it can't be named there when even its widest word doesn't fit, or when names
 * stacked apart would sit off their lines by more than half a line.
 */
function nameReferences({
  available,
  measured,
  references,
  width,
  y,
}: {
  available: number;
  measured: Measure;
  references: PlotVisual["references"];
  width: number;
  y: LinearScale;
}): ReferencePlan | null {
  const names = references.map(({ label }) => label);
  const widestWord = getWidestWord(names, measured.labelWidth);

  if (widestWord > available) {
    return null;
  }

  const longest = Math.max(...names.map((name) => measured.labelWidth(name)));
  const room = Math.min(longest, Math.max(width * MAX_GUTTER_SHARE, widestWord), available);

  const marks = references.map((reference) => {
    const lines = wrapLabel({ label: reference.label, labelWidth: measured.labelWidth, room });
    const lineY = y.toPixel(reference.y);
    const top = lineY - blockHeight({ lines }) / 2;

    return { label: reference.label, lines, offset: 0, top, y: lineY };
  });

  const stacked = stackReferences({ bottom: y.range[0], marks });

  if (
    stacked.some((mark) => Math.abs(mark.top + blockHeight(mark) / 2 - mark.y) > MAX_NAME_SHIFT)
  ) {
    return null;
  }

  const widestLine = Math.max(
    ...stacked.flatMap((mark) => mark.lines.map((line) => measured.labelWidth(line))),
  );

  return { key: [], marks: stacked, width: REFERENCE_INSET + widestLine };
}

/**
 * Each line carries a number, from the top line down, level with its line; numbers of lines closer
 * than a line of text sit side by side instead of stacking off their lines.
 */
function numberReferences({
  measured,
  references,
  y,
}: {
  measured: Measure;
  references: PlotVisual["references"];
  y: LinearScale;
}): ReferencePlan {
  const markerWidth = measured.labelWidth(String(references.length));
  const columns: number[] = [];

  const sorted = references
    .map((reference) => ({ label: reference.label, y: y.toPixel(reference.y) }))
    .toSorted((a, b) => a.y - b.y);

  const marks = sorted.map((reference, index) => {
    const free = columns.findIndex((lastY) => reference.y - lastY >= LABEL_LINE_HEIGHT);
    const column = free === -1 ? columns.length : free;
    columns[column] = reference.y;

    return {
      label: reference.label,
      lines: [String(index + 1)],
      offset: column * markerWidth,
      top: reference.y - LABEL_LINE_HEIGHT / 2,
      y: reference.y,
    };
  });

  return {
    key: marks.map((mark) => ({ label: mark.label, marker: mark.lines[0] ?? "" })),
    marks,
    width: REFERENCE_INSET + columns.length * markerWidth,
  };
}

export function planReferences({
  left,
  measured,
  references,
  width,
  y,
}: {
  left: number;
  measured: Measure;
  references: PlotVisual["references"];
  width: number;
  y: LinearScale;
}): ReferencePlan {
  if (references.length === 0) {
    return { key: [], marks: [], width: PADDING.right };
  }

  const available = width - left - REFERENCE_INSET - MIN_PLOT_WIDTH;

  return (
    nameReferences({ available, measured, references, width, y }) ??
    numberReferences({ measured, references, y })
  );
}
