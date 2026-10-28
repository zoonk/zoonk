import { type PlanBases } from "./plan-bases";
import { type StoredBaseChoice } from "./plan-state";

/**
 * The recommended start's stored choices, for the bases open to it (see `getOpenChoices`);
 * essential is the default, so needs no overrides.
 */
export function toRecommendedBaseChoices({ bases, recommended }: PlanBases): StoredBaseChoice[] {
  return recommended === "essential"
    ? []
    : bases
        .filter((base) => base.choices.includes(recommended))
        .map((base) => ({ choice: recommended, skillId: base.skillId }));
}
