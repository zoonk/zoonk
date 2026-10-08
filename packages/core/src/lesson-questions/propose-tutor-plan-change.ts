import "server-only";
import { prisma } from "@zoonk/db";
import { isUuid } from "@zoonk/utils/uuid";
import { toProvenanceData } from "../library/_utils/library-rows";
import { isPlanReady, proposeChange } from "../plans/_utils/apply-plan-change";
import { type PlanChangeCaution, findChangeCautions } from "../plans/_utils/change-cautions";
import { findOwnedPlan, loadPlanChangeView } from "../plans/_utils/owned-plan";
import { type PlanContext, loadPlanContext } from "../plans/_utils/plan-context";
import { interpretPlanWords } from "../plans/_utils/plan-words";
import { revalidatePlanTags, withPlanRetry } from "../plans/_utils/replan";
import { type PlanOperation } from "../plans/plan-contract";
import { type PlanChangeView } from "../plans/plan-view-contract";
import { type PlanOperationError } from "../plans/planner/plan-operations";
import { getSession } from "../users/get-session";
import { findAnsweringQuestion } from "./_utils/answering-question";

/** Parts of the learner's words no change covers ("and aim for 800"), for the buddy to answer. */
type LeftOut = { leftOut: string[] };

export type TutorPlanChangeResult =
  | (LeftOut & {
      /** What the change costs that the buddy says before the learner applies it. */
      cautions: PlanChangeCaution[];
      change: PlanChangeView;
      /** Earlier proposals still waiting that this one replaced: it changes the same thing. */
      replaced: string[];
      status: "proposed";
    })
  | (LeftOut & { error: PlanOperationError; status: "invalid" })
  /** The plan already works that way, or the change wouldn't move anything: nothing to apply. */
  | (LeftOut & { status: "unchanged" })
  | { status: "notFound" | "notReady" | "notUnderstood" | "unauthorized" };

/**
 * Ties the proposal to the answer that made it. An earlier proposal of the conversation still
 * waits for its own answer unless this one changes the same thing (`proposeChange` replaces it
 * then). A generation that lost its claim meanwhile leaves its proposal declined, unseen.
 */
async function linkToAnswer({
  changeId,
  questionId,
  revision,
}: {
  changeId: string;
  questionId: string;
  revision: number;
}): Promise<boolean> {
  const linked = await prisma.lessonQuestion.updateMany({
    data: { planChangeId: changeId },
    where: { generationRevision: revision, id: questionId, status: "running" },
  });

  if (linked.count === 0) {
    await prisma.planChange.update({ data: { status: "declined" }, where: { id: changeId } });
  }

  return linked.count > 0;
}

async function proposeForGoal({
  goalId,
  request,
}: {
  goalId: string;
  request: string;
}): Promise<
  | Exclude<TutorPlanChangeResult, { status: "proposed" }>
  | (LeftOut & {
      changeId: string;
      goal: PlanContext["goal"];
      operations: PlanOperation[];
      replaced: string[];
      status: "proposed";
    })
> {
  const owned = await findOwnedPlan({ goalId });

  if (owned.status !== "ready") {
    return owned;
  }

  if (!isPlanReady(owned.context)) {
    return { status: "notReady" };
  }

  const { data, provenance } = await interpretPlanWords({ context: owned.context, text: request });

  if (!data.understood) {
    return { status: "notUnderstood" };
  }

  return withPlanRetry(async () => {
    const context = await loadPlanContext({ goal: owned.context.goal });

    if (!context) {
      return { status: "notFound" as const };
    }

    const result = await proposeChange({
      approval: "always",
      context,
      operations: data.operations,
      provenance: toProvenanceData(provenance),
      reason: data.summary,
      source: "planEdit",
    });

    const { leftOut } = data;

    if (result.status === "invalid" || result.status === "unchanged") {
      return { ...result, leftOut };
    }

    // A ready plan with `approval: "always"` stores every change as a proposal.
    return result.status === "proposed"
      ? {
          changeId: result.changeId,
          goal: context.goal,
          leftOut,
          operations: data.operations,
          replaced: result.replaced ?? [],
          status: "proposed" as const,
        }
      : { status: "notReady" as const };
  });
}

/**
 * The buddy asks for a change to the learner's plan while it answers them ("I want to study 1
 * hour a day", "no studying on Saturdays", "the exam moved to January 24"): the learner's words,
 * as the conversation made them clear, read into the same changes the plan's controls make. The
 * change never applies here: it's stored as a proposal with its effect, tied to the answer, and
 * waits for the learner's tap (Apply or Not now) in the conversation, on Today or on the Journey.
 * A change that would leave the plan as it is is never offered (`unchanged`), so the buddy says so;
 * parts of the words no change covers come back as `leftOut`, so the buddy answers those too; and
 * a change that moves an exam off the day its notice sets carries that day (`officialDate`). What
 * the change costs (an exam subject with questions left out, a plan ending weeks before its date)
 * comes back as `cautions`, for the buddy to say before the learner applies it.
 * Only the generation answering the learner's own question about one of their goals may ask.
 */
export async function proposeTutorPlanChange({
  questionId,
  request,
  revision,
}: {
  questionId: string;
  /** The change in the learner's words, self-contained (no "that" or "the same"). */
  request: string;
  revision: number;
}): Promise<TutorPlanChangeResult> {
  const session = await getSession();

  if (!session) {
    return { status: "unauthorized" };
  }

  const text = request.trim();

  if (!isUuid(questionId) || !text) {
    return { status: "notFound" };
  }

  const question = await findAnsweringQuestion({ questionId, revision, userId: session.user.id });

  const goalId = question?.thread.goalId;

  if (!goalId) {
    return { status: "notFound" };
  }

  const proposed = await proposeForGoal({ goalId, request: text });

  if (proposed.status !== "proposed") {
    return proposed;
  }

  const linked = await linkToAnswer({ ...proposed, questionId, revision });
  revalidatePlanTags(session.user.id);

  if (!linked) {
    return { status: "notFound" };
  }

  const change = await loadPlanChangeView(proposed.changeId);

  const cautions = await findChangeCautions({
    effect: change.effect,
    goal: proposed.goal,
    operations: proposed.operations,
  });

  return {
    cautions,
    change,
    leftOut: proposed.leftOut,
    replaced: proposed.replaced,
    status: "proposed",
  };
}
