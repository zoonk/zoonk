import { normalizeString } from "@zoonk/utils/string";
import { type WrittenSample } from "../../learner/facts/written-samples";

type Criterion = WrittenSample["prompt"]["criteria"][number];
type Grade = WrittenSample["answer"]["grade"];
type PointGrade = Extract<Grade, { kind: "points" }>;

const PRESENTATION_WORD =
  /(?:^|[^a-z])(?:presentation|structure|apresentacao|estrutura)(?:$|[^a-z])/u;

const LANGUAGE_WORD =
  /(?:^|[^a-z])(?:language|grammar|spelling|orthography|lingua|linguagem|gramatica|ortografia|modalidade escrita formal|norma culta|norma[- ]padrao)(?:$|[^a-z])/u;

const LEVEL_SHARE = { complete: 1, missing: 0, partial: 1 / 3, strong: 2 / 3 };

function getCriterionKind({ id, name }: Criterion) {
  const words = normalizeString(`${id} ${name}`);

  if (PRESENTATION_WORD.test(words)) {
    return "presentation";
  }

  return LANGUAGE_WORD.test(words) ? "language" : "content";
}

function getLevelShare({
  criteria,
  levels,
  weighted = false,
}: {
  criteria: readonly Criterion[];
  levels: Grade["criteria"];
  weighted?: boolean;
}) {
  const usePoints = weighted && criteria.every(({ points }) => points !== null);
  const weights = new Map(criteria.map(({ id, points }) => [id, usePoints ? (points ?? 1) : 1]));

  const assessed = levels.flatMap(({ id, level }) => {
    const weight = weights.get(id);
    return weight === undefined ? [] : [{ share: LEVEL_SHARE[level], weight }];
  });

  const totalWeight = assessed.reduce((sum, { weight }) => sum + weight, 0);

  return totalWeight > 0
    ? assessed.reduce((sum, { share, weight }) => sum + share * weight, 0) / totalWeight
    : null;
}

function getPresentationPoints({
  criteria,
  rows,
}: {
  criteria: readonly Criterion[];
  rows: PointGrade["rows"];
}) {
  const ids = new Set(criteria.map(({ id }) => id));
  const selected = rows.filter(({ id }) => ids.has(id));
  const max = selected.reduce((sum, row) => sum + row.max, 0);

  const earned = selected.reduce(
    (sum, row) => sum + (row.range ? (row.range.low + row.range.high) / 2 : row.earned),
    0,
  );

  return max > 0 ? Math.min(1, Math.max(0, earned / max)) : null;
}

export function getWrittenTrendShares({
  criteria,
  grade,
  numericEligible,
}: {
  criteria: readonly Criterion[];
  grade: Grade;
  numericEligible: boolean;
}) {
  const groups = Map.groupBy(criteria, getCriterionKind);
  const presentation = groups.get("presentation") ?? [];
  const presentationLevel = getLevelShare({ criteria: presentation, levels: grade.criteria });

  if (grade.kind === "levels") {
    return {
      contentShare: getLevelShare({
        criteria: groups.get("content") ?? [],
        levels: grade.criteria,
        weighted: true,
      }),
      presentationShare: presentationLevel,
    };
  }

  return {
    contentShare: numericEligible
      ? Math.min(1, Math.max(0, (grade.content.low + grade.content.high) / (2 * grade.max)))
      : null,
    presentationShare:
      (numericEligible
        ? getPresentationPoints({ criteria: presentation, rows: grade.rows })
        : null) ?? presentationLevel,
  };
}
