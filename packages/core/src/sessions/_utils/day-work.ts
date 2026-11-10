import "server-only";
import { type BlockCapsule, type BlockDrill } from "../block-payload";
import {
  type PlannedCheckpoint,
  type SessionBuildInput,
  buildSessionBlocks,
} from "../session-builder";
import { loadDayCapsules } from "./day-capsules";
import { type loadDayPlan } from "./day-plan";
import { loadPracticeItems } from "./load-practice";
import { type SessionDayContext, loadSessionPlacement } from "./session-placement";

export type DayPracticeQuery = Omit<Parameters<typeof loadPracticeItems>[0], "excludeItemIds">;

export type DayWork = Pick<
  SessionBuildInput,
  "capsules" | "drills" | "placementItemIds" | "practice"
>;

/** Checkpoint questions must stay out of drills; a correct checkpoint answer fixes their mistake too. */
function withoutCheckpointItems({
  checkpointItems,
  drills,
}: {
  checkpointItems: ReadonlySet<string>;
  drills: readonly BlockDrill[];
}): BlockDrill[] {
  return drills
    .map((drill) => ({ ...drill, itemIds: drill.itemIds.filter((id) => !checkpointItems.has(id)) }))
    .filter((drill) => drill.itemIds.length > 0);
}

export async function loadDayWork({
  checkpointItems,
  context,
  dueCapsules,
  dueDrills,
  isReviewDay,
  plan,
  practiceQuery,
}: {
  checkpointItems: ReadonlySet<string>;
  context: SessionDayContext;
  dueCapsules: readonly BlockCapsule[];
  dueDrills: readonly BlockDrill[];
  isReviewDay: boolean;
  plan: Awaited<ReturnType<typeof loadDayPlan>>;
  practiceQuery: DayPracticeQuery;
}): Promise<DayWork> {
  const drills = withoutCheckpointItems({ checkpointItems, drills: dueDrills });
  const reserved = new Set([...drills.flatMap((drill) => drill.itemIds), ...checkpointItems]);

  const capsules = await loadDayCapsules({
    capsules: dueCapsules,
    isReviewDay,
    reserved,
    userId: context.userId,
  });

  const used = new Set([...reserved, ...capsules.flatMap((capsule) => capsule.itemIds)]);
  const placementItemIds = await loadSessionPlacement({ context, isReviewDay, plan, used });

  const practice = await loadPracticeItems({
    ...practiceQuery,
    excludeItemIds: new Set([...used, ...placementItemIds]),
  });

  return { capsules, drills, placementItemIds, practice };
}

/** Only a checkpoint the day holds keeps its questions from the rest of the day. */
export async function loadHeldDayInput({
  checkpoints,
  loadInput,
}: {
  checkpoints: readonly PlannedCheckpoint[];
  loadInput: (checkpointItems: ReadonlySet<string>) => Promise<SessionBuildInput>;
}): Promise<SessionBuildInput> {
  const offered = new Set(checkpoints.flatMap((checkpoint) => checkpoint.itemIds));
  const input = await loadInput(offered);

  if (offered.size === 0) {
    return input;
  }

  const held = new Set(
    buildSessionBlocks(input).blocks.flatMap((block) =>
      block.kind === "checkpoint" ? block.payload.itemIds : [],
    ),
  );

  // Freed questions only grow review and practice, so the rebuilt day can't take on a challenge they came from.
  return held.size === offered.size ? input : loadInput(held);
}
