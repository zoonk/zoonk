import { type PlanBasesView } from "../plan-view-contract";
import { type PlanBases, getBaseChoices } from "../planner/plan-bases";
import { type PlanSettings } from "../planner/plan-state";

export function toPlanBasesView({
  bases,
  settings,
}: {
  bases: Pick<PlanBases, "bases" | "daysLeft">;
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
              choices: base.choices,
              minutes: {
                deep: Math.max(1, Math.round(base.minutes.deep)),
                essential: Math.max(1, Math.round(base.minutes.essential)),
                quick: Math.max(1, Math.round(base.minutes.quick)),
              },
              name: base.name,
              neededFor: base.neededFor,
              skillId: base.skillId,
              studied: base.studied,
            },
          ],
    ),
    knownCount: bases.bases.filter((base) => base.known).length,
  };
}
