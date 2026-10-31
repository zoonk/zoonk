import { type StudySessionSummary } from "../session-types";

type SkillMove = StudySessionSummary["skillsMoved"][number];

const SHOWN_RISES = 2;

const STATE_RANK: Readonly<Record<SkillMove["to"], number>> = {
  learning: 1,
  mastered: 3,
  new: 0,
  solid: 2,
};

/** A skill that slipped back is memory's to bring back, not news for the end of the day. */
export function getRisenSkills(moves: readonly SkillMove[]): SkillMove[] {
  return moves.filter((move) => STATE_RANK[move.to] > STATE_RANK[move.from]).slice(0, SHOWN_RISES);
}
