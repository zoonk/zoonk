import { type WritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { type WritingRange, sumRanges } from "../../scoring/written-points";

export const ENEM_WRITING_MAX = 1000;

const STEP = 40;
const COMPETENCE_MAX = 200;
const COMPETENCE_IDS = ["c1", "c2", "c3", "c4", "c5"] as const;

const LEVEL_RANGE = {
  complete: { high: 200, low: 200 },
  missing: { high: 40, low: 0 },
  partial: { high: 120, low: 80 },
  strong: { high: 160, low: 160 },
} as const;

const ZERO = { high: 0, low: 0 };
const PROPOSAL_CAP = { conditional: 80, invalid: 0, tangent: 40 } as const;

// Edital 64/2026 §§14.5–14.6: average two accepted examiners. Their totals are
// multiples of 40, so the largest difference within 100 is 80.
const COMPETENCE_DISCREPANCY_LIMIT = 80;
const TOTAL_DISCREPANCY_LIMIT = 100;
const TOTAL_MEAN_DELTA = (Math.floor(TOTAL_DISCREPANCY_LIMIT / STEP) * STEP) / 2;

export function hasEnemCompetences(criteria: readonly { id: string }[]) {
  return (
    criteria.length === COMPETENCE_IDS.length &&
    COMPETENCE_IDS.every((id) => criteria.some((criterion) => criterion.id === id))
  );
}

function competenceBand(assessed: WritingRange, min = 0, max = COMPETENCE_MAX) {
  const secondLow = Math.max(min, assessed.low - COMPETENCE_DISCREPANCY_LIMIT);
  const secondHigh = Math.min(max, assessed.high + COMPETENCE_DISCREPANCY_LIMIT);

  return {
    assessed,
    range: { high: (assessed.high + secondHigh) / 2, low: (assessed.low + secondLow) / 2 },
  };
}

function proposalBand({ interventionElements, proposalLimit }: WritingEvidence) {
  const cap = proposalLimit ? PROPOSAL_CAP[proposalLimit] : COMPETENCE_MAX;

  if (!interventionElements || cap === 0) {
    return { assessed: ZERO, range: ZERO };
  }

  const count = Object.values(interventionElements).filter(Boolean).length;
  const points = Math.min(cap, STEP * Math.max(count, 1));

  return competenceBand({ high: points, low: points }, STEP, cap);
}

export function scoreEnemWriting(evidence: WritingEvidence, zero: boolean) {
  if (
    !zero &&
    (!hasEnemCompetences(evidence.criteria) || evidence.interventionElements === undefined)
  ) {
    return null;
  }

  const criteria = new Map(evidence.criteria.map((criterion) => [criterion.id, criterion.level]));

  const bands = COMPETENCE_IDS.map((id) => {
    if (zero) {
      return { assessed: ZERO, id, range: ZERO };
    }

    const band =
      id === "c5"
        ? proposalBand(evidence)
        : competenceBand(LEVEL_RANGE[criteria.get(id) ?? "missing"]);

    return { ...band, id };
  });

  const assessed = sumRanges(bands.map((band) => band.assessed));
  const possible = sumRanges(bands.map((band) => band.range));

  if (!assessed || !possible) {
    return null;
  }

  // Each row is marginal. The total must also satisfy the discrepancy limit across all rows.
  const content = {
    high: Math.min(possible.high, assessed.high + TOTAL_MEAN_DELTA),
    low: Math.max(possible.low, assessed.low - TOTAL_MEAN_DELTA),
  };

  const rows = bands.map(({ id, range }) => ({
    earned: range.low,
    id,
    max: COMPETENCE_MAX,
    range,
  }));

  return { content, rows };
}
