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

/** What a pass lays its work out from (see `createLayOut`). */
type LayOutInput = Omit<
  Parameters<typeof scheduleCarriedAndRest>[0],
  "carried" | "days" | "units" | "yielded"
> & {
  /** Where the run's new work starts (see `getOpenStart`). */
  start: Date;
  /** This week's kept work, as the run that saved it laid it out (see `listThisWeekWork`). */
  thisWeek: Parameters<typeof layOutAfterThisWeek>[0]["kept"];
  /** The units left to place. */
  units: readonly QueueUnit[];
};

/**
 * How a pass lays its work out on any of its days, this week's kept work included, as the run that
 * saved it laid it out: what comes after this week starts where it did (see `keepThisWeek`), and
 * what earlier days left comes first, as it was planned (see `scheduleCarriedAndRest`).
 */
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
        // A new lesson can remove its stand-in entirely: reconstruct the queue before it landed,
        // rather than filtering a queue in which that old topic has already disappeared.
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
