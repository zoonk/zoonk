import { type PlanBases } from "./plan-bases";
import { type StoredBaseChoice } from "./plan-state";

export function toRecommendedBaseChoices({ bases, recommended }: PlanBases): StoredBaseChoice[] {
  return recommended === "essential"
    ? []
    : bases
        .filter((base) => base.choices.includes(recommended))
        .map((base) => ({ choice: recommended, skillId: base.skillId }));
}
