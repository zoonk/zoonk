import "server-only";
import {
  type PlannedCheckpoint,
  type SessionBuildInput,
  buildSessionBlocks,
} from "../session-builder";
import { loadUnreservedCapsules } from "./day-capsules";
import { type loadDayPlan } from "./day-plan";
import { loadPracticeItems } from "./load-practice";
import { loadReviewCapsules } from "./load-review-capsules";
import { type SessionDayContext, loadSessionPlacement } from "./session-placement";

export type DayPracticeQuery = Omit<Parameters<typeof loadPracticeItems>[0], "excludeItemIds">;

export type DayWork = Pick<
  SessionBuildInput,
  "capsules" | "placementItemIds" | "placementRecheckItemIds" | "practice"
>;

export async function loadDayWork({
  checkpointItems,
  context,
  isReviewDay,
  plan,
  practiceQuery,
  review,
  signals,
}: {
  checkpointItems: ReadonlySet<string>;
  context: SessionDayContext;
  isReviewDay: boolean;
  plan: Awaited<ReturnType<typeof loadDayPlan>>;
  practiceQuery: DayPracticeQuery;
  review: Parameters<typeof loadReviewCapsules>[0];
  signals: Parameters<typeof loadSessionPlacement>[0]["signals"];
}): Promise<DayWork> {
  const capsules = isReviewDay
    ? await loadReviewCapsules({ ...review, reserved: checkpointItems })
    : await loadUnreservedCapsules({
        capsules: await loadReviewCapsules(review),
        reserved: checkpointItems,
      });

  const used = new Set([...checkpointItems, ...capsules.flatMap((capsule) => capsule.itemIds)]);
  const placement = await loadSessionPlacement({ context, isReviewDay, plan, signals, used });

  const practice = await loadPracticeItems({
    ...practiceQuery,
    excludeItemIds: new Set([...used, ...placement.placementItemIds]),
  });

  return { capsules, ...placement, practice };
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
