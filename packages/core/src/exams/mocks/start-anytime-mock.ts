import "server-only";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { getAnytimeMockAccess } from "./_utils/anytime-mock-access";
import { loadAnytimeMockSetup, resolveAnytimeOption } from "./_utils/anytime-mock-setup";
import { type CreateAnytimeMockResult, createAnytimeMock } from "./_utils/create-anytime-mock";
import { findMockQuestionsCap } from "./_utils/mock-question-writes";
import { type AnytimeMockInput } from "./mock-contract";

export type StartAnytimeMockResult =
  | CreateAnytimeMockResult
  | {
      status:
        | "goalNotActive"
        | "invalidOption"
        | "notExam"
        | "notFound"
        | "plusRequired"
        | "unauthorized";
    };

export async function startAnytimeMock({
  goalId,
  input,
}: {
  goalId: string;
  input: AnytimeMockInput;
}): Promise<StartAnytimeMockResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  const { goal, userId } = owned;

  if (goal.kind !== "exam") {
    return { status: "notExam" };
  }

  if (goal.status !== "active") {
    return { status: "goalNotActive" };
  }

  const [access, setup, writesCap] = await Promise.all([
    getAnytimeMockAccess(goal),
    loadAnytimeMockSetup(goal),
    findMockQuestionsCap(),
  ]);

  if (access !== "open") {
    return { status: access };
  }

  const pick = resolveAnytimeOption({ choice: input, setup });

  const asksNothing =
    pick?.option.questions === 0 &&
    (pick.purpose === "placement" || pick.option.written.length === 0);

  if (!pick || asksNothing) {
    return { status: "invalidOption" };
  }

  const result = await createAnytimeMock({
    acceptFewer: input.acceptFewer ?? false,
    goal,
    pick,
    setup,
    userId,
    writesCap: pick.purpose === "placement" ? null : writesCap,
  });

  if (result.status === "started") {
    revalidateCacheTags([getLearnerModelCacheTag(userId)]);
  }

  return result;
}
