import "server-only";
import { revalidateCacheTags } from "../../cache/revalidate-cache-tags";
import { getLearnerModelCacheTag } from "../../cache/tags";
import { findOwnedGoal, getAnswerTimeZone } from "../../learner/_utils/owned-goal";
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

/**
 * "Take a mock" whenever the learner wants, as often as they want, beside the plan's weekly mocks:
 * the option they picked (an exam day in full, half of one, or one subject), or in onboarding a
 * diagnostic mock in the length they picked as placement, starts at once from the shared bank, its
 * first section's clock running (`started`, by its own id). A mock already running continues
 * instead (`running`). Every mock exam comes with Plus, and the learner's own daily study time
 * never stops one they asked for. A bank short of questions the learner never answered answers
 * `needsQuestions` while their plan's fair use can have new ones written: write them (POST the
 * goal's mock generations), then start again. Past it, a mock of a subject or half a day asks
 * questions they answered before for the rest, the missed ones first; a full mock never does. A
 * mock still well short of its questions answers `short` with what it can ask, for the learner to
 * start it knowingly (`acceptFewer`).
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

  const [access, setup, writesCap] = await Promise.all([
    getAnytimeMockAccess({ goal, timeZone }),
    loadAnytimeMockSetup(goal),
    findMockQuestionsCap(),
  ]);

  if (access !== "open") {
    return { status: access };
  }

  const pick = resolveAnytimeOption({ choice: input, setup });

  // A mock asks questions, or a written part only (a day that is all written).
  const asksNothing =
    pick?.option.questions === 0 &&
    (pick.purpose === "placement" || pick.option.written.length === 0);

  if (!pick || asksNothing) {
    return { status: "invalidOption" };
  }

  // A diagnostic mock's few missing questions are small help, which fair use for mocks never stops.
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
