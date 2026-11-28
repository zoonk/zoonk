import "server-only";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { markPlanItemsTestedOut } from "../../learner/_utils/known-skills";
import { getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { loadMockPlanOffers } from "./_utils/mock-adapt";
import { findOwnedMock } from "./_utils/owned-mock";
import { type MockPlanOfferInput, mockResultSchema } from "./mock-contract";

export type AdaptPlanFromMockResult =
  | { changeId: string | null; lessonsSkipped: number; status: "applied" }
  | { status: "notFound" | "unauthorized" | "unchanged" };

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

  const { blueprint, goal, mock, userId } = found.owned;

  if (!goal || mock?.status !== "finished") {
    return { status: "notFound" };
  }

  const offers = await loadMockPlanOffers({
    blueprint,
    goal,
    purpose: mock.conditions.purpose,
    result: mockResultSchema.safeParse(mock.result).data ?? null,
  });

  if (!offers) {
    return { status: "unchanged" };
  }

  const skipped = await markPlanItemsTestedOut({
    goalId: goal.id,
    items: offers.plan.items,
    knownSkillIds: offers.aced,
    testedOutAt: new Date(),
    timeZone: getAnswerTimeZone({ goal, timeZone: input.timeZone }),
  });

  revalidateCacheTags([getLearnerModelCacheTag(userId)]);

  return skipped.planItemIds.length > 0
    ? { changeId: skipped.changeId, lessonsSkipped: skipped.lessonsSkipped, status: "applied" }
    : { status: "unchanged" };
}
