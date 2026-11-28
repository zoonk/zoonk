import "server-only";
import { type Goal } from "@zoonk/db";
import { isNetScored } from "../../checkpoints/weekly-challenge-rules";
import { getGoalField } from "../../library/items/item-field";
import { type BlockCapsule, getBlockItemIds, readBlockPayload } from "../block-payload";
import { EXTRA_BLOCK_MINUTES } from "../extra-time";
import { buildReviewBlock } from "../session-builder";
import { type DayBlockInput } from "./day-block-view";
import { loadUnreservedCapsules } from "./day-capsules";
import { loadDayPlan } from "./day-plan";
import { toReviewInput } from "./day-queries";
import { buildExtraPractice } from "./extra-blocks";
import { loadReviewCapsules } from "./load-review-capsules";

export async function planPreparingMockReview({
  blocks,
  due,
  goal,
  localDate,
  plan: knownPlan,
  preparing,
  timeZone,
}: {
  blocks: readonly Pick<DayBlockInput, "kind" | "payload" | "position" | "status">[];
  due?: readonly BlockCapsule[];
  goal: Goal;
  localDate: Date;
  plan?: Awaited<ReturnType<typeof loadDayPlan>>;
  preparing: ReadonlySet<number>;
  timeZone: string;
}) {
  if (
    preparing.size === 0 ||
    blocks.some(
      (block) =>
        block.status === "active" ||
        (block.status === "pending" && !preparing.has(block.position)) ||
        readBlockPayload(block).mockPreparationReview,
    )
  ) {
    return null;
  }

  const context = { goal, localDate, timeZone, userId: goal.userId };
  const plan = knownPlan ?? (await loadDayPlan({ ...context, now: new Date() }));

  const query = toReviewInput({
    context,
    field: getGoalField(goal.details),
    netScored: isNetScored(plan.structure),
    plan,
  });

  const reserved = new Set(blocks.flatMap((block) => getBlockItemIds(readBlockPayload(block))));

  const available = (capsules: readonly BlockCapsule[]) =>
    loadUnreservedCapsules({ capsules, reserved });

  const dueCapsules = await available(due ?? (await loadReviewCapsules(query)));
  const weakestReview = dueCapsules.length === 0;

  const capsules = weakestReview
    ? await available(await loadReviewCapsules({ ...query, weakest: true }))
    : dueCapsules;

  const review =
    buildReviewBlock({ capsules, input: { placementItemIds: [], weakestReview } }) ??
    (await buildExtraPractice({
      includeUnstudied: true,
      minutes: Math.min(goal.dailyMinutes, EXTRA_BLOCK_MINUTES),
      session: { blocks, goal, goalId: goal.id },
      skillIds: [...query.skillIds],
      userId: goal.userId,
    }));

  return (
    review && {
      ...review,
      payload: { ...review.payload, extra: false, mockPreparationReview: true as const },
    }
  );
}
