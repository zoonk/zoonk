import "server-only";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
import { getDailyTimeLimitStatus } from "../../minors/get-daily-time-limit";
import { getAnytimeMockAccess } from "./_utils/anytime-mock-access";
import { loadAnytimeMockSetup, resolveAnytimeOption } from "./_utils/anytime-mock-setup";
import { type CreateAnytimeMockResult, createAnytimeMock } from "./_utils/create-anytime-mock";
import { type AnytimeMockInput } from "./mock-contract";

export type StartAnytimeMockResult =
  | CreateAnytimeMockResult
  | {
      status:
        | "dailyLimitReached"
        | "goalNotActive"
        | "invalidOption"
        | "notExam"
        | "notFound"
        | "plusRequired"
        | "unauthorized";
    };

/**
 * "Take a mock" whenever the learner wants, beside the plan's weekly mocks: the option they picked
 * (an exam day in full, half of one, or one subject), or in onboarding a diagnostic mock in the
 * length they picked as placement, starts at once from the shared bank's questions they never
 * answered, its first section's clock running (`started`, by its own id). A mock already running
 * continues instead (`running`). Every mock exam comes with Plus. A guardian's daily limit stops a
 * new one. A bank short of the mock's questions answers `needsQuestions`: write them (POST the
 * goal's mock generations), then start again.
 */
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

  const timeZone = getAnswerTimeZone({ goal, timeZone: input.timeZone });

  const [access, limit, setup] = await Promise.all([
    getAnytimeMockAccess({ goal, timeZone }),
    getDailyTimeLimitStatus(),
    loadAnytimeMockSetup(goal),
  ]);

  if (access !== "open") {
    return { status: access };
  }

  if (limit?.reached) {
    return { status: "dailyLimitReached" };
  }

  const pick = resolveAnytimeOption({ choice: input, setup });

  if (!pick || pick.option.questions === 0) {
    return { status: "invalidOption" };
  }

  const result = await createAnytimeMock({
    acceptFewer: input.acceptFewer ?? false,
    goal,
    pick,
    setup,
    userId,
  });

  if (result.status === "started") {
    revalidateCacheTags([getLearnerModelCacheTag(userId)]);
  }

  return result;
}
