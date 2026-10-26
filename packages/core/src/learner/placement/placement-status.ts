import { type PlacementSkill } from "./placement-graph";

/**
 * Placement is sure about a skill at 80%: known at or above it, unknown at or below 20%. It stops
 * when every area of every phase has a starting point it is that sure about, not after a set
 * number of questions.
 */
export const PLACEMENT_CONFIDENCE = 0.8;

/**
 * What placement's walk makes of a skill (see `readSkillStatuses`): `known` once its own answers
 * confirm it, `claimed` and `inferred` while only the learner's word or a right answer on what
 * builds on it says so (to confirm: placement asks the learner's word first), `unknown` and
 * `unsure` from its beliefs.
 */
export type SkillPlacementStatus = "claimed" | "inferred" | "known" | "unknown" | "unsure";

/** Each of the goal's skills' status, by skill id; a skill not in it is unsure. */
export type SkillStatuses = ReadonlyMap<string, SkillPlacementStatus>;

/** What a belief alone says of a skill: confirming it as known takes its own answers. */
export function getSkillPlacementStatus(
  belief: number | undefined,
): Exclude<SkillPlacementStatus, "claimed" | "inferred"> {
  if (belief === undefined) {
    return "unsure";
  }

  if (belief >= PLACEMENT_CONFIDENCE) {
    return "known";
  }

  return belief <= 1 - PLACEMENT_CONFIDENCE ? "unknown" : "unsure";
}

export function statusOf({ skill, statuses }: { skill: PlacementSkill; statuses: SkillStatuses }) {
  return statuses.get(skill.id) ?? "unsure";
}

/** A skill placement still has to ask about: unsure, or taken on trust and not confirmed yet. */
export function isOpen(status: SkillPlacementStatus): boolean {
  return status === "claimed" || status === "inferred" || status === "unsure";
}
