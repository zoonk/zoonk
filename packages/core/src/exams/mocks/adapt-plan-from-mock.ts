import "server-only";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { markPlanItemsTestedOut } from "../../learner/_utils/known-skills";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { type UnchangedFocusReason } from "../../plans/_utils/apply-plan-change";
import { changeGoalPlan } from "../../plans/change-goal-plan";
import { loadMockPlanOffers } from "./_utils/mock-adapt";
import { findOwnedMock } from "./_utils/owned-mock";
import { type MockPlanOfferInput, mockResultSchema } from "./mock-contract";

export type AdaptPlanFromMockResult =
  | { changeId: string | null; lessonsSkipped: number; status: "applied" }
  /**
   * Nothing moved: what it offered is no longer there, or for a focus, why the plan stays as it
   * is (see `UnchangedFocusReason`).
   */
  | { reason: UnchangedFocusReason | null; status: "unchanged" }
  | { status: "notFound" | "unauthorized" };

/**
 * The learner's yes to what a finished mock offered (see `MockAdaptView`), through the plan's own
 * paths: `skip` tests out the plan items that teach only topics the mock showed they know, with
 * the change's undo, and `focus` gives the area that went worst more of the plan's time, as a
 * focus they chose. The offer is worked out again from the plan as it is now.
 */
export async function adaptPlanFromMock({
  blockId,
  input,
}: {
  blockId: string;
  input: MockPlanOfferInput;
}): Promise<AdaptPlanFromMockResult> {
  const found = await findOwnedMock(blockId);

  if (found.status !== "ready") {
    return found;
  }

  const { goal, mock, userId } = found.owned;

  if (!goal || mock?.status !== "finished") {
    return { status: "notFound" };
  }

  const offers = await loadMockPlanOffers({
    goal,
    purpose: mock.conditions.purpose,
    result: mockResultSchema.safeParse(mock.result).data ?? null,
  });

  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });

  if (input.offer === "skip") {
    if (!offers?.view.skip) {
      return { reason: null, status: "unchanged" };
    }

    const skipped = await markPlanItemsTestedOut({
      goalId: goal.id,
      items: offers.plan.items,
      knownSkillIds: offers.aced,
      testedOutAt: new Date(),
      timeZone,
    });

    revalidateCacheTags([getLearnerModelCacheTag(userId)]);

    return skipped.planItemIds.length > 0
      ? {
          changeId: skipped.changeId,
          lessonsSkipped: skipped.planItemIds.length,
          status: "applied",
        }
      : { reason: null, status: "unchanged" };
  }

  if (!offers?.view.focus) {
    return { reason: null, status: "unchanged" };
  }

  const changed = await changeGoalPlan({
    goalId: goal.id,
    input: {
      operations: [{ areas: [...offers.focusAreas, offers.view.focus.area], kind: "focusAreas" }],
      timeZone,
    },
  });

  if (changed.status === "applied") {
    return { changeId: changed.change?.id ?? null, lessonsSkipped: 0, status: "applied" };
  }

  if (changed.status === "notFound" || changed.status === "unauthorized") {
    return changed;
  }

  return { reason: changed.status === "unchanged" ? changed.reason : null, status: "unchanged" };
}
