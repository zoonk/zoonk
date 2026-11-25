import { type BuildPlanInput } from "./build-plan";
import { listBegunSkillIds } from "./carried-bases";
import { fromIsoDate } from "./plan-calendar";
import { type ExistingPlanItem } from "./plan-items";
import { type ScheduledUnit } from "./schedule-units";

/**
 * A topic's lessons start where its stand-in's time did, after the lessons of it the run keeps
 * and the first lesson of a base the learner hasn't begun, wherever this run placed a base that
 * landed too. Null when such a base got no day by `end`: the topic waits with it for the days
 * laid out after.
 */
export function getFirstDay({
  end,
  frozen,
  input,
  landed,
  own,
  placed,
  skillId,
}: {
  end: Date | null;
  frozen: readonly ExistingPlanItem[];
  input: BuildPlanInput;
  landed: Pick<ReadonlySet<string>, "has">;
  own: readonly [string, number][];
  placed: readonly ScheduledUnit[];
  skillId: string;
}): Date | null {
  const begun = listBegunSkillIds({ carried: [], items: input.items });

  const firstOf = (base: string) =>
    input.items.flatMap((entry) =>
      entry.status === "todo" &&
      entry.kind === "lesson" &&
      entry.skillId === base &&
      entry.scheduledFor
        ? [entry.scheduledFor.getTime()]
        : [],
    );

  const placedOf = (base: string) =>
    placed.flatMap((unit) => (unit.skillId === base ? [unit.date.getTime()] : []));

  const unbegun = (input.prerequisites.get(skillId) ?? []).filter((base) => !begun.has(base));

  if (end && unbegun.some((base) => landed.has(base) && placedOf(base).length === 0)) {
    return null;
  }

  const bases = unbegun.flatMap((base) => {
    const days = landed.has(base) ? placedOf(base) : firstOf(base);
    return days.length > 0 ? [Math.min(...days)] : [];
  });

  const kept = frozen.flatMap((entry) =>
    entry.lessonId && entry.skillId === skillId && entry.scheduledFor
      ? [entry.scheduledFor.getTime()]
      : [],
  );

  const first = own.map(([date]) => date).toSorted()[0];

  return new Date(
    Math.max(input.today.getTime(), first ? fromIsoDate(first).getTime() : 0, ...bases, ...kept),
  );
}
