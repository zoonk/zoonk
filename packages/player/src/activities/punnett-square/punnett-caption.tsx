"use client";

import { genotype } from "@zoonk/core/library/activities/punnett-square";
import { useExtracted } from "next-intl";
import { type PunnettFill, traitCounts } from "./punnett-model";

/**
 * One line under the square: the tally of each trait while filling it, then either how many
 * squares the check's question counts or how many the learner got right.
 */
export function PunnettCaption({
  counted,
  expected,
  fill,
  outputName,
  phenotypes,
}: {
  /** Squares the check's question counts, once checked; null otherwise. */
  counted: number | null;
  /** The right genotypes once checked; empty while answering. */
  expected: readonly string[];
  fill: PunnettFill;
  outputName: string;
  phenotypes: { dominant: string; recessive: string };
}) {
  const t = useExtracted();
  const total = String(fill.length);

  function text() {
    if (counted !== null) {
      return t("{count} of {total} squares: {what}", {
        count: String(counted),
        total,
        what: outputName,
      });
    }

    if (expected.length > 0) {
      const right = fill.filter(
        (cell, index) =>
          cell !== null && genotype(cell.charAt(0), cell.charAt(1)) === expected[index],
      ).length;

      return t("{count} of {total} squares right", { count: String(right), total });
    }

    const counts = traitCounts(fill);

    return t("{dominant}: {dominantCount} of {total} · {recessive}: {recessiveCount} of {total}", {
      dominant: phenotypes.dominant,
      dominantCount: String(counts.dominant),
      recessive: phenotypes.recessive,
      recessiveCount: String(counts.recessive),
      total,
    });
  }

  return (
    <p aria-live="polite" className="text-muted-foreground text-center text-sm tabular-nums">
      {text()}
    </p>
  );
}
