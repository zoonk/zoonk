import { type BuildPlanInput } from "./build-plan";
import { listBegunSkillIds } from "./carried-bases";
import { type LandedUnits } from "./landed-lessons";
import { isStandIn } from "./plan-item-rules";
import { type ScheduledUnit } from "./schedule-units";

export function getBaseDays({
  input,
  keeps,
  laid,
  landed,
}: {
  input: BuildPlanInput;
  keeps: boolean;
  laid: readonly ScheduledUnit[];
  landed: LandedUnits;
}): Map<string, Date> {
  const dated = keeps
    ? input.items.flatMap((item) =>
        item.status === "todo" && item.kind === "lesson" && item.skillId && item.scheduledFor
          ? [{ date: item.scheduledFor, skillId: item.skillId }]
          : [],
      )
    : laid.flatMap((unit) =>
        unit.kind === "lesson" && unit.skillId ? [{ date: unit.date, skillId: unit.skillId }] : [],
      );

  const firsts = Map.groupBy(dated, (entry) => entry.skillId);
  const begun = listBegunSkillIds({ carried: [], items: input.items });

  const firstOf = (skillId: string) =>
    Math.min(...(firsts.get(skillId) ?? []).map((entry) => entry.date.getTime()));

  return new Map(
    [...landed.keys()].flatMap((skillId) => {
      const days = (input.prerequisites.get(skillId) ?? [])
        .filter((base) => !landed.has(base) && !begun.has(base) && firsts.has(base))
        .map((base) => firstOf(base));

      return days.length > 0 ? [[skillId, new Date(Math.max(...days))] as const] : [];
    }),
  );
}

export function getStandInDays(input: BuildPlanInput): Map<string, Date> {
  return new Map(
    input.items.flatMap((item) =>
      item.status === "todo" && isStandIn(item) && item.scheduledFor && item.skillId
        ? [
            [
              item.skillId,
              item.scheduledFor < input.today ? input.today : item.scheduledFor,
            ] as const,
          ]
        : [],
    ),
  );
}
