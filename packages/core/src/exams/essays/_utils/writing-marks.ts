import { type WritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { type WritingQuoteLookup, createWritingQuoteLookup } from "./writing-quotes";
import { type SheetBasis, type SheetRow, listWritingRows } from "./writing-sheet";

export type RowMark = { reported: number; row: SheetRow; verified: number | null };

function countDistinctPassages(
  quotes: readonly (string | null)[],
  lookup: WritingQuoteLookup,
): number {
  const spans = quotes
    .flatMap((quote) => lookup.locate(quote) ?? [])
    .toSorted((first, second) => first.end - second.end);

  return spans.reduce(
    (kept, span) => (span.start >= kept.end ? { count: kept.count + 1, end: span.end } : kept),
    { count: 0, end: 0 },
  ).count;
}

function countElements({
  elements,
  lookup,
  row,
}: {
  elements: WritingEvidence["elements"];
  lookup: WritingQuoteLookup;
  row: SheetRow;
}): number {
  if (!row.parts) {
    return countDistinctPassages(
      elements.map(({ quote }) => quote),
      lookup,
    );
  }

  const named = new Set(row.parts.map(({ id }) => id));

  return new Set(
    elements.flatMap(({ part, quote }) =>
      part !== null && named.has(part) && lookup.locate(quote) ? [part] : [],
    ),
  ).size;
}

function highestCountedAward({
  award,
  count,
  row,
}: {
  award: number;
  count: number;
  row: SheetRow;
}) {
  return row.awards.findLastIndex(
    (candidate, index) => index <= award && (candidate.count ?? 0) <= count,
  );
}

/**
 * A key's aspect above its lowest award without a passage found in the answer earns the lowest.
 * A row of the board's scale with no such passage stays unverified, since its lowest award would
 * be a mark the grader never gave. The level a learner sees reads the reported award either way.
 */
export function markWritingRows({
  basis,
  eligible,
  evidence,
}: {
  basis: SheetBasis;
  eligible: string;
  evidence: Pick<WritingEvidence, "awards" | "elements">;
}): RowMark[] {
  const lookup = createWritingQuoteLookup(eligible);
  const reports = Map.groupBy(evidence.awards, ({ row }) => row);
  const elements = Map.groupBy(evidence.elements, ({ row }) => row);

  return listWritingRows(basis).map((row, index): RowMark => {
    const own = reports.get(index) ?? [];
    const [report] = own;
    const unsupported = row.kind === "aspect" ? 0 : null;

    if (own.length !== 1 || !report || report.award >= row.awards.length) {
      return { reported: 0, row, verified: unsupported };
    }

    if (report.award > 0 && !lookup.locate(report.quote)) {
      return { reported: report.award, row, verified: unsupported };
    }

    const count = countElements({ elements: elements.get(index) ?? [], lookup, row });
    const verified = Math.max(0, highestCountedAward({ award: report.award, count, row }));
    return { reported: report.award, row, verified };
  });
}
