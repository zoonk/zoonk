import { type BuildPlanInput } from "./build-plan";
import { placeCarriedWork } from "./carry-over";
import { listQuickBaseIds } from "./chosen-bases";
import { countKeptLessons } from "./kept-items";
import { type LaidOutOrder, scheduleLearnedOrder } from "./learned-order";
import { type ExistingPlanItem } from "./plan-items";
import { type QueueUnit } from "./plan-units";
import { scheduleRest } from "./rest-schedule";
import { type PlanDay } from "./schedule-units";
import { scoreSkillTopics } from "./topic-weights";

/**
 * What earlier days left, laid on the first days as it was planned (see `placeCarriedWork`), and
 * the rest of the plan in the time after it: in the order the plan with every base's core took
 * (`learnedOrder`, see `scheduleLearnedOrder`) while its cores fit, or as `scheduleRest` lays it
 * out. Short on time, the carried work the cut ranks out gives way (see `scheduleCoresFirst`), and
 * the plan is laid out once more with it among the rest, where it competes for the time like any
 * other lesson: carried first whatever their topic, the days Câmara's learner missed pushed out a
 * topic asked as often that they had missed. A plan following another one's order ranks its own
 * carried work too: it carried in what that one held back for its base, unranked, while a class
 * test's viruses, which placement had missed, were set aside. `yielded` names the carried work
 * that gave way, which the plan sets aside when it doesn't fit (see `setAsideLeftWork`), and so
 * does carried work that waits among the rest for the base its skill builds on (see
 * `keepCarriedAfterBases`).
 */
export function scheduleCarriedAndRest({
  days,
  finished,
  input,
  learnedOrder,
  phaseEnds,
  planStart,
  queue,
  units,
  unitsByKey,
}: {
  days: readonly PlanDay[];
  /** The items the plan keeps as they are (see `splitExistingItems`). */
  finished: readonly ExistingPlanItem[];
  input: BuildPlanInput;
  learnedOrder: LaidOutOrder | null;
  /** The phase end dates the run keeps (see `keepPhaseEnds`). */
  phaseEnds: ReadonlyMap<number, Date>;
  planStart: Date;
  queue: Parameters<typeof scheduleRest>[0]["queue"];
  /** The units left to place. */
  units: readonly QueueUnit[];
  unitsByKey: ReadonlyMap<string, QueueUnit>;
}) {
  const layOut = (yielded: ReadonlySet<string>) => {
    const placed = placeCarriedWork({ days, input, phaseEnds, units, yielded });

    const learned =
      learnedOrder &&
      scheduleLearnedOrder({
        days: placed.days,
        order: learnedOrder,
        quickBases: listQuickBaseIds(input),
        rest: placed.rest,
      });

    const scheduleRanked = () =>
      scheduleRest({
        announcements: input.announcements,
        answeredWrongSkillIds: input.answeredWrongSkillIds,
        carried: placed.carried,
        days: placed.days,
        goal: input.goal,
        graph: input.graph,
        kept: countKeptLessons({
          gaps: input.missedSkillIds,
          kept: finished,
          lessons: placed.carried,
          units: unitsByKey,
        }),
        knownSkillIds: input.knownSkillIds,
        missedSkillIds: input.missedSkillIds ?? new Set(),
        opening: {
          knownAreas: input.knownAreas ?? new Set(),
          noticeAreas: input.noticeAreas ?? null,
        },
        phaseEnds,
        planStart,
        queue,
        settings: input.settings,
        topics: scoreSkillTopics({ graph: input.graph, levels: input.topicLevels ?? [] }),
        units: placed.rest,
      });

    const restSchedule = learned
      ? { ...learned, yielded: placed.carried.length > 0 ? scheduleRanked().yielded : [] }
      : scheduleRanked();

    return { carriedSchedule: placed.schedule, released: placed.released, restSchedule };
  };

  const first = layOut(new Set());
  const yielded = new Set(first.restSchedule.yielded);
  const laid = yielded.size > 0 ? layOut(yielded) : first;

  return { ...laid, yielded: new Set([...yielded, ...laid.released]) };
}
