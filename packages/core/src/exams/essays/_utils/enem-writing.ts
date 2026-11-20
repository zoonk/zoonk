import { type WritingEvidence } from "@zoonk/ai/tasks/grading/grade-essay";
import { sumRanges } from "../../scoring/written-points";

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

const PROPOSAL_CAP = { conditional: 80, invalid: 0, tangent: 40 } as const;

export function hasEnemCompetences(criteria: readonly { id: string }[]) {
  return (
    criteria.length === COMPETENCE_IDS.length &&
    COMPETENCE_IDS.every((id) => criteria.some((criterion) => criterion.id === id))
  );
}

function proposalPoints(evidence: WritingEvidence) {
  const { interventionElements, proposalLimit } = evidence;

  const elements = interventionElements
    ? Object.values(interventionElements).filter(Boolean).length
    : 0;

  const points = interventionElements ? STEP * Math.max(elements, 1) : 0;

  return proposalLimit ? Math.min(points, PROPOSAL_CAP[proposalLimit]) : points;
}

export function scoreEnemWriting(evidence: WritingEvidence, zeroReason: string | null) {
  if (
    !zeroReason &&
    (!hasEnemCompetences(evidence.criteria) || evidence.interventionElements === undefined)
  ) {
    return null;
  }

  const criteria = new Map(evidence.criteria.map((criterion) => [criterion.id, criterion.level]));

  const proposal = proposalPoints(evidence);

  const rows = COMPETENCE_IDS.map((id) => {
    const assessed =
      id === "c5" ? { high: proposal, low: proposal } : LEVEL_RANGE[criteria.get(id) ?? "missing"];

    const range = zeroReason ? { high: 0, low: 0 } : assessed;

    return { earned: range.low, id, max: COMPETENCE_MAX, range };
  });

  const content = sumRanges(rows.map(({ range }) => range));

  return content && { content, rows };
}
