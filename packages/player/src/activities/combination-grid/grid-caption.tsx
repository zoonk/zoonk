"use client";

import { useExtracted } from "next-intl";
import { type GridFill, sameCell, traitCounts } from "./grid-model";
import { type GridTraits } from "./grid-parts";

export function GridCaption({
  counted,
  expected,
  fill,
  outputName,
  traits,
}: {
  counted: number | null;
  expected: readonly string[];
  fill: GridFill;
  outputName: string | null;
  traits: GridTraits;
}) {
  const t = useExtracted();
  const total = fill.length;

  function text() {
    if (counted !== null && outputName !== null) {
      return t(
        "{count} of {total, plural, =0 {# squares} one {# square} other {# squares}}: {what}",
        { count: String(counted), total, what: outputName },
      );
    }

    if (expected.length > 0) {
      const right = fill.filter(
        (cell, index) => cell !== null && sameCell(cell, expected[index] ?? ""),
      ).length;

      return t(
        "{count} of {total, plural, =0 {# squares} one {# square} other {# squares}} right",
        { count: String(right), total },
      );
    }

    if (!traits) {
      const filled = fill.filter((cell) => cell !== null).length;

      return t(
        "{count} of {total, plural, =0 {# squares} one {# square} other {# squares}} filled",
        { count: String(filled), total },
      );
    }

    const counts = traitCounts(fill);

    return t("{dominant}: {dominantCount} of {total} · {recessive}: {recessiveCount} of {total}", {
      dominant: traits.dominant,
      dominantCount: String(counts.dominant),
      recessive: traits.recessive,
      recessiveCount: String(counts.recessive),
      total: String(total),
    });
  }

  return (
    <p aria-live="polite" className="text-muted-foreground text-center text-sm tabular-nums">
      {text()}
    </p>
  );
}
