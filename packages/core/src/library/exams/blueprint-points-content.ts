import { type BlueprintExtraction } from "@zoonk/ai/tasks/research/extract-exam-blueprint";
import { normalizeString } from "@zoonk/utils/string";
import {
  type FinalShare,
  type MarkingRow,
  type PointsMinimum,
  type ScoredPart,
} from "./blueprint-contract";
import { type KeptFacts, keptOr } from "./blueprint-kept";
import { getMarkingPenalty } from "./marking-penalty";
import { getPartMaxPoints } from "./part-points";

type Scoring = NonNullable<BlueprintExtraction["mock"]>["scoring"];

const MAX_PERCENT = 100;

/** Shares a reading rounds, such as 0.67 and 0.34, can add up to a little over the whole. */
const MAX_SHARES_TOTAL = 1.01;

const LABEL_PATTERN = /\((?<label>[^()]+)\)\s*$/u;

function toLabel(name: string): string | null {
  const label = LABEL_PATTERN.exec(name)?.groups?.label;
  return label ? normalizeString(label) : null;
}

/**
 * A notice's table can name a test by another column, such as "Prova objetiva (P1)" for
 * "Conhecimentos básicos (P1)": the label they share ties them.
 */
function findPartName({ name, partNames }: { name: string; partNames: readonly string[] }) {
  const same = partNames.find((known) => normalizeString(known) === normalizeString(name));
  const label = toLabel(name);
  const labeled = label ? partNames.filter((known) => toLabel(known) === label) : [];
  const distinct = new Set(labeled.map((known) => normalizeString(known)));
  return same ?? (distinct.size === 1 ? (labeled[0] ?? null) : null);
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
    const penalty = keptOr({ gap: null, id: `${id}.wrongPoints`, kept, value: row.wrongPoints });

    const share = getMarkingPenalty({ points: row.points, wrongPoints: penalty });

    return [
      {
        citation,
        format: row.format,
        part,
        points: row.points,
        questions: questions !== null && questions >= 1 ? questions : null,
        select: row.select,
        wrongPoints: share === null ? null : penalty,
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

function toFinalShares({
  kept,
  partNames,
  scoring,
}: {
  kept: KeptFacts;
  partNames: readonly string[];
  scoring: Scoring;
}): FinalShare[] {
  const shares = scoring.finalShares.flatMap((share, index) => {
    const citation = kept.get(`mock.scoring.finalShares.${index}`)?.[0];
    const names = share.parts.map((name) => findPartName({ name, partNames }));
    const parts = [...new Set(names.filter((name) => name !== null))];
    const isKnown = parts.length > 0 && names.every((name) => name !== null);

    return citation && isKnown && share.share > 0 && share.share <= 1
      ? [{ citation, parts, share: share.share }]
      : [];
  });

  const parts = shares.flatMap((share) => share.parts);
  const total = shares.reduce((sum, share) => sum + share.share, 0);

  return new Set(parts).size === parts.length && total <= MAX_SHARES_TOTAL ? shares : [];
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
  const finalShares = toFinalShares({ kept, partNames, scoring });

  return {
    ...(finalShares.length > 0 ? { finalShares } : {}),
    ...(marking.length > 0 ? { marking } : {}),
    ...(parts.length > 0 ? { parts } : {}),
    ...(totalMinimum ? { totalMinimum } : {}),
  };
}
