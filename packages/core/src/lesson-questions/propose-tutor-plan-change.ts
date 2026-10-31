import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { unchanged, writeLearnerChange } from "../learner/_utils/write-learner-change";
import { toProvenanceData } from "../library/_utils/library-rows";
import { isPlanReady, proposeChange } from "../plans/_utils/apply-plan-change";
import { type PlanChangeCaution, findChangeCautions } from "../plans/_utils/change-cautions";
import { findOwnedPlan, loadPlanChangeView } from "../plans/_utils/owned-plan";
import { type PlanContext } from "../plans/_utils/plan-context";
import { loadPlanAtToken } from "../plans/_utils/plan-token";
import { interpretPlanWords } from "../plans/_utils/plan-words";
import { revalidatePlanTags } from "../plans/_utils/replan";
import { withPlanRetry } from "../plans/plan-conflict";
import { type PlanOperation } from "../plans/plan-contract";
import { type PlanChangeView } from "../plans/plan-view-contract";
import { type PlanOperationError } from "../plans/planner/plan-operations";
import { getSession } from "../users/get-session";
import { findAnsweringGoal } from "./_utils/answering-question";

/** leftOut contains learner requests no supported plan operation covered; the buddy must answer them separately. */
type LeftOut = { leftOut: string[] };

export type TutorPlanChangeResult =
  | (LeftOut & {
      /** Explain these costs before the learner applies the change. */
      cautions: PlanChangeCaution[];
      change: PlanChangeView;
      /** Ids of earlier proposals superseded by this one. */
      replaced: string[];
      status: "proposed";
    })
  | (LeftOut & { error: PlanOperationError; status: "invalid" })
  | (LeftOut & { status: "unchanged" })
  | { status: "notFound" | "notReady" | "notUnderstood" | "unauthorized" };

/** A generation that loses its claim must leave its proposal declined and unseen. */
async function linkToAnswer({
  changeId,
  questionId,
  revision,
  userId,
}: {
  changeId: string;
  questionId: string;
  revision: number;
  userId: string;
}): Promise<boolean> {
  return writeLearnerChange({ userId }, async (tx) => {
    const question = await tx.lessonQuestion.findUnique({ where: { id: questionId } });

    if (question?.generationRevision === revision && question.status === "running") {
      if (question.planChangeId === changeId) {
        return unchanged(true);
      }

      await tx.lessonQuestion.update({
        data: { planChangeId: changeId },
        where: { id: questionId },
      });

      return true;
    }

    const declined = await tx.planChange.updateMany({
      data: { status: "declined" },
      where: { id: changeId, status: "proposed" },
    });

    return declined.count > 0 ? false : unchanged(false);
  });
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
    const context = await loadPlanAtToken(owned.context.goal.id);

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

/** Only the claimed answer may propose changes to its saved goal; never applies them. The learner must confirm, after seeing cautions. */
export async function proposeTutorPlanChange({
  questionId,
  request,
  revision,
}: {
  questionId: string;
  /** Self-contained learner words; resolve references such as that or the same before calling. */
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

  const goal = await findAnsweringGoal({ questionId, revision, userId: session.user.id });

  if (!goal) {
    return { status: "notFound" };
  }

  const proposed = await proposeForGoal({ goalId: goal.id, request: text });

  if (proposed.status !== "proposed") {
    return proposed;
  }

  const linked = await linkToAnswer({ ...proposed, questionId, revision, userId: session.user.id });
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
