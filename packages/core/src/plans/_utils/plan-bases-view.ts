import { type PlanBasesView } from "../plan-view-contract";
import { type PlanBases, getBaseChoices } from "../planner/plan-bases";
import { type PlanSettings } from "../planner/plan-state";

/**
 * The plan's bases as the learner chooses how to study them: the ones still to choose for, each
 * with the learner's choice and what each choice takes (in whole minutes), and how many the
 * learner already showed they know. Null when the plan has none.
 */
export function toPlanBasesView({
  bases,
  settings,
}: {
  bases: PlanBases;
  settings: Pick<PlanSettings, "baseChoices">;
}): PlanBasesView | null {
  if (bases.bases.length === 0) {
    return null;
  }

  const choices = getBaseChoices({ bases: bases.bases, choices: settings.baseChoices });

  return {
    daysLeft: bases.daysLeft,
    items: bases.bases.flatMap((base) =>
      base.known
        ? []
        : [
            {
              area: base.area,
              choice: choices.get(base.skillId) ?? "essential",
              minutes: {
                deep: Math.max(1, Math.round(base.minutes.deep)),
                essential: Math.max(1, Math.round(base.minutes.essential)),
                quick: Math.max(1, Math.round(base.minutes.quick)),
              },
              name: base.name,
              neededFor: base.neededFor,
              skillId: base.skillId,
            },
          ],
    ),
    knownCount: bases.bases.filter((base) => base.known).length,
    recommended: bases.recommended,
  };
}
