import { scheduleCarriedAndRest } from "./carried-and-rest";
import { getItemKey } from "./plan-items";
import { buildPlanQueue } from "./plan-queue";
import { type QueueUnit } from "./plan-units";
import { withoutRepeatedTitles } from "./repeated-titles";
import { type PlanDay } from "./schedule-units";
import { layOutShownDay } from "./shown-day-layout";
import { getShownReferenceLessons } from "./shown-day-lessons";
import { layOutAfterThisWeek } from "./week-after";
import { markKeptLessons } from "./whole-boss";

type LayOutInput = Omit<
  Parameters<typeof scheduleCarriedAndRest>[0],
  "carried" | "days" | "units" | "yielded"
> & {
  start: Date;
  thisWeek: Parameters<typeof layOutAfterThisWeek>[0]["kept"];
  units: readonly QueueUnit[];
};

export function createLayOut({ start, thisWeek, units, ...rest }: LayOutInput) {
  const layOut = ({
    context = rest,
    days,
    kept = [],
    units: selected,
  }: {
    context?: typeof rest;
    days: readonly PlanDay[];
    kept?: typeof rest.kept;
    units: readonly QueueUnit[];
  }) =>
    layOutAfterThisWeek({
      days,
      kept: thisWeek,
      layOut: (laid) =>
        scheduleCarriedAndRest({ ...context, ...laid, kept: [...context.kept, ...kept] }),
      start,
      units: selected,
    });

  return (planDays: readonly PlanDay[]) =>
    layOutShownDay({
      days: planDays,
      input: rest.input,
      layOut,
      layOutBefore: ({ days, fresh }) => {
        // A new lesson can remove its stand-in entirely, so the queue is rebuilt from before it
        // landed.
        const input = {
          ...rest.input,
          lessons: getShownReferenceLessons({ fresh, input: rest.input }),
        };

        const { units: before, ...queue } = buildPlanQueue(input);
        const finished = new Set(rest.kept.map((item) => getItemKey(item)));

        const ordered = withoutRepeatedTitles({
          kept: rest.kept,
          units: before.filter((unit) => !finished.has(unit.key)),
        });

        return layOut({
          context: {
            ...rest,
            input,
            queue,
            unitsByKey: new Map(before.map((unit) => [unit.key, unit])),
          },
          days,
          units: markKeptLessons({ input, kept: rest.kept, units: ordered }),
        });
      },
      units,
    });
}
