import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { normalizeString } from "@zoonk/utils/string";
import { type MarkingRow, type PointsMinimum, type ScoredPart } from "./blueprint-contract";
import { type KeptFacts, keptOr } from "./blueprint-kept";
import { getPartMaxPoints } from "./part-points";

type Scoring = NonNullable<BlueprintExtraction["mock"]>["scoring"];

const MAX_PERCENT = 100;

function findPartName({ name, partNames }: { name: string; partNames: readonly string[] }) {
  return partNames.find((known) => normalizeString(known) === normalizeString(name)) ?? null;
}

function toMarking({
  kept,
  partNames,
  scoring,
}: {
  kept: KeptFacts;
  partNames: readonly string[];
  scoring: Scoring;
}): MarkingRow[] {
  return scoring.marking.flatMap((row, index) => {
    const id = `mock.scoring.marking.${index}`;
    const citation = kept.get(id)?.[0];
    const part = row.part === null ? null : findPartName({ name: row.part, partNames });

    if (!citation || row.points <= 0 || (row.part !== null && part === null)) {
      return [];
    }

    const questions = keptOr({ gap: null, id: `${id}.questions`, kept, value: row.questions });
    const penalty = keptOr({ gap: null, id: `${id}.wrongPenalty`, kept, value: row.wrongPenalty });

    return [
      {
        citation,
        format: row.format,
        part,
        points: row.points,
        questions: questions !== null && questions >= 1 ? questions : null,
        wrongPenalty: penalty !== null && penalty >= 0 && penalty <= 1 ? penalty : null,
      },
    ];
  });
}

function isPossibleMinimum({
  max,
  minimum,
}: {
  max: number | null;
  minimum: PointsMinimum;
}): boolean {
  if (minimum.value <= 0) {
    return false;
  }

  return minimum.unit === "percent"
    ? minimum.value <= MAX_PERCENT
    : max === null || minimum.value <= max;
}

function toPart({
  id,
  kept,
  marking,
  name,
  part,
}: {
  id: string;
  kept: KeptFacts;
  marking: readonly MarkingRow[];
  name: string;
  part: Scoring["parts"][number];
}): ScoredPart | null {
  const stated = keptOr({ gap: null, id: `${id}.maxPoints`, kept, value: part.maxPoints });
  const maxPoints = stated !== null && stated > 0 ? stated : null;
  const counted = keptOr({ gap: null, id: `${id}.questions`, kept, value: part.questions });
  const questions = counted !== null && counted >= 1 ? counted : null;
  const max = getPartMaxPoints({ marking, part: { maxPoints, name, questions } });
  const read = keptOr({ gap: null, id: `${id}.minimum`, kept, value: part.minimum });
  const minimum = read && isPossibleMinimum({ max, minimum: read }) ? read : null;
  const qualifying = part.qualifying && kept.has(`${id}.qualifying`);

  const citation = [
    questions !== null && `${id}.questions`,
    maxPoints !== null && `${id}.maxPoints`,
    minimum !== null && `${id}.minimum`,
    qualifying && `${id}.qualifying`,
  ]
    .filter((fact) => typeof fact === "string")
    .flatMap((fact) => kept.get(fact) ?? [])[0];

  return citation ? { citation, maxPoints, minimum, name, qualifying, questions } : null;
}

function toParts({
  kept,
  marking,
  partNames,
  scoring,
}: {
  kept: KeptFacts;
  marking: readonly MarkingRow[];
  partNames: readonly string[];
  scoring: Scoring;
}): ScoredPart[] {
  return scoring.parts.reduce<ScoredPart[]>((parts, part, index) => {
    const name = findPartName({ name: part.name, partNames });

    if (name === null || parts.some((other) => other.name === name)) {
      return parts;
    }

    const scored = toPart({ id: `mock.scoring.parts.${index}`, kept, marking, name, part });
    return scored ? [...parts, scored] : parts;
  }, []);
}

function toTotalMinimum({ kept, scoring }: { kept: KeptFacts; scoring: Scoring }) {
  const { totalMinimum } = scoring;
  const citation = kept.get("mock.scoring.totalMinimum")?.[0];

  if (!totalMinimum || !citation || !isPossibleMinimum({ max: null, minimum: totalMinimum })) {
    return null;
  }

  return { citation, unit: totalMinimum.unit, value: totalMinimum.value };
}

/** A part is a test or block as a kept subject's `group` or `name` writes it. */
export function toPointsScoring({
  kept,
  partNames,
  scoring,
}: {
  kept: KeptFacts;
  partNames: readonly string[];
  scoring: Scoring;
}) {
  const marking = toMarking({ kept, partNames, scoring });
  const parts = toParts({ kept, marking, partNames, scoring });
  const totalMinimum = toTotalMinimum({ kept, scoring });

  return {
    ...(marking.length > 0 ? { marking } : {}),
    ...(parts.length > 0 ? { parts } : {}),
    ...(totalMinimum ? { totalMinimum } : {}),
  };
}
