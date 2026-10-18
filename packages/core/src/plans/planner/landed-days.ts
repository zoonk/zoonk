import { type BuildPlanInput } from "./build-plan";
import { listBegunSkillIds } from "./carried-bases";
import { isStandInItem } from "./kept-items";
import { type LandedUnits } from "./landed-lessons";
import { type ScheduledUnit } from "./schedule-units";

/**
 * The first day each landed skill's lessons may go on: the day the first lesson still to do of a
 * skill it builds on is due, in the plan as the run keeps it (`keeps`: as saved) or lays it out.
 * Put where its stand-in's time began, a career plan's usability lessons came two days before the
 * interface hierarchy they build on (R16). A base the learner began holds nothing back: a Câmara
 * skill's lessons waited a month for the next lesson of a base with 9 lessons done.
 */
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

/** The day each stand-in of the plan is saved for, today at the earliest. */
export function getStandInDays(input: BuildPlanInput): Map<string, Date> {
  return new Map(
    input.items.flatMap((item) =>
      item.status === "todo" && isStandInItem(item) && item.scheduledFor && item.skillId
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
