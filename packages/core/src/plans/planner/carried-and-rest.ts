import { type BuildPlanInput } from "./build-plan";
import { placeCarriedWork } from "./carry-over";
import { listQuickBaseIds } from "./chosen-bases";
import { countKeptLessons } from "./kept-items";
import { type LaidOutOrder, scheduleLearnedOrder } from "./learned-order";
import { type ExistingPlanItem, getItemKey } from "./plan-items";
import { type QueueUnit } from "./plan-units";
import { scheduleRest } from "./rest-schedule";
import { type PlanDay } from "./schedule-units";
import { scoreSkillTopics } from "./topic-weights";
import { markKeptLessons } from "./whole-boss";

function listKeptOutside({
  kept,
  units,
}: {
  kept: readonly ExistingPlanItem[];
  units: readonly QueueUnit[];
}): ExistingPlanItem[] {
  const laid = new Set(units.map((unit) => unit.key));
  const byKey = new Map(kept.map((item) => [getItemKey(item), item]));

  return [...byKey].flatMap(([key, item]) => (laid.has(key) ? [] : [item]));
}

export function scheduleCarriedAndRest({
  days,
  input,
  kept,
  learnedOrder,
  phaseEnds,
  planStart,
  queue,
  units,
  unitsByKey,
}: {
  days: readonly PlanDay[];
  input: BuildPlanInput;
  kept: readonly ExistingPlanItem[];
  learnedOrder: LaidOutOrder | null;
  phaseEnds: ReadonlyMap<number, Date>;
  planStart: Date;
  queue: Parameters<typeof scheduleRest>[0]["queue"];
  units: readonly QueueUnit[];
  unitsByKey: ReadonlyMap<string, QueueUnit>;
}) {
  const layOut = (yielded: ReadonlySet<string>) => {
    const placed = placeCarriedWork({ days, input, phaseEnds, units, yielded });

    const rest = markKeptLessons({
      kept: placed.schedule.units.map((unit) => ({
        kind: unit.kind,
        phase: unit.phase,
        scheduledFor: unit.teachingEnd ?? unit.date,
      })),
      units: placed.rest,
    });

    const learned =
      learnedOrder &&
      scheduleLearnedOrder({
        days: placed.days,
        order: learnedOrder,
        quickBases: listQuickBaseIds(input),
        rest,
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
          kept: listKeptOutside({ kept, units }),
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
        units: rest,
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
