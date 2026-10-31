import { type PlacementSkill } from "./placement-graph";

export const PLACEMENT_CONFIDENCE = 0.8;

/** claimed is the learner's word; inferred is prerequisite evidence. Neither is known until own answers confirm it. */
export type SkillPlacementStatus = "claimed" | "inferred" | "known" | "unknown" | "unsure";

/** Missing skills are unsure. */
export type SkillStatuses = ReadonlyMap<string, SkillPlacementStatus>;

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

export function isOpen(status: SkillPlacementStatus): boolean {
  return status === "claimed" || status === "inferred" || status === "unsure";
}
