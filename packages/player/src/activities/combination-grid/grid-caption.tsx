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
    const right =
      expected.length > 0
        ? fill.filter((cell, index) => cell !== null && sameCell(cell, expected[index] ?? ""))
            .length
        : null;

    if (right !== null && (!traits || right < total)) {
      return t(
        "{count} of {total, plural, =0 {# squares} one {# square} other {# squares}} right",
        { count: String(right), total },
      );
    }

    if (traits) {
      const counts = traitCounts(fill);

      return t(
        "{dominant}: {dominantCount} of {total} · {recessive}: {recessiveCount} of {total}",
        {
          dominant: traits.dominant,
          dominantCount: String(counts.dominant),
          recessive: traits.recessive,
          recessiveCount: String(counts.recessive),
          total: String(total),
        },
      );
    }

    if (counted !== null && outputName !== null) {
      return t(
        "{count} of {total, plural, =0 {# squares} one {# square} other {# squares}} show {what}",
        { count: String(counted), total, what: outputName },
      );
    }

    const filled = fill.filter((cell) => cell !== null).length;

    return t("{count} of {total, plural, =0 {# squares} one {# square} other {# squares}} filled", {
      count: String(filled),
      total,
    });
  }

  return (
    <p aria-live="polite" className="text-muted-foreground text-sm tabular-nums">
      {text()}
    </p>
  );
}
