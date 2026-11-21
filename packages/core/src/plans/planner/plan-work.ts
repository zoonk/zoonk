import { type BuildPlanInput } from "./build-plan";
import { splitExistingItems } from "./kept-items";
import { type Landing } from "./landed-lessons";
import { findLandedUnits } from "./landed-placement";
import { type MockResolution } from "./mock-identity";
import { addDays, getEndOfWeek } from "./plan-calendar";
import { buildPlanQueue } from "./plan-queue";
import { createDays, getOpenStart, listFundedPlanDays } from "./plan-run-days";
import { getPendingOrder } from "./this-week-items";
import { limitWrittenTeaching } from "./writing-allocation";

export function preparePlanWork({
  input,
  landing,
  planStart,
  resolution,
}: {
  input: BuildPlanInput;
  landing: Landing | null;
  planStart: Date;
  resolution: MockResolution | null;
}) {
  const { units: queue, ...priorities } = buildPlanQueue(input);

  const { keepsRest, landedUnits } = findLandedUnits({ input, landing, queue });

  const split = splitExistingItems({
    input,
    keepsRest,
    landedSkillIds: landedUnits ?? undefined,
    queue,
  });

  const { finished, frozen } = split;
  const days = createDays({ input, planStart });
  const { finishedKeys, ordered, unitsByKey } = getPendingOrder({ finished, frozen, queue });
  const start = frozen.length > 0 ? addDays(getEndOfWeek(input.today), 1) : getOpenStart(input);

  const funded = listFundedPlanDays({
    days,
    input,
    resolution,
    start,
    units: queue,
    writing: { planStart, units: ordered },
  });

  const { deferred, limited } = funded.writingSchedule
    ? limitWrittenTeaching({
        held: new Set(input.openedKeys),
        minutes: funded.teachingMinutes ?? 0,
        units: ordered,
        writing: input.writing,
      })
    : { deferred: [], limited: ordered };

  return {
    deferred,
    finishedKeys,
    funded,
    keepsRest,
    landedUnits,
    limited,
    priorities,
    queue,
    split,
    start,
    unitsByKey,
    windows: days.windows,
    writing: {
      writingRequirement: funded.writingRequirement,
      writingSchedule: funded.writingSchedule,
    },
  };
}
