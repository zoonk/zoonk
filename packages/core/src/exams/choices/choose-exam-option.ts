import "server-only";
import { type Goal, type TransactionClient, prisma } from "@zoonk/db";
import { trackPlanEdited } from "../../analytics/track-plan-edited";
import { oweGoalLessons } from "../../follow-ups/owe-goal-lessons";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { applyChangeNow } from "../../plans/_utils/apply-plan-change";
import { loadPlanChangeView } from "../../plans/_utils/owned-plan";
import { type PlanContext } from "../../plans/_utils/plan-context";
import { loadPlanAtToken } from "../../plans/_utils/plan-token";
import { withPlanRetry } from "../../plans/plan-conflict";
import { type PlanChangeView } from "../../plans/plan-view-contract";
import { type PlanOperationError } from "../../plans/planner/plan-operations";
import { type ExamChoiceInput } from "./exam-choice-contract";
import { type ExamChoice, findChosenOptions, isSamePick } from "./exam-choices";

export type ExamChoiceResult =
  | { change: PlanChangeView | null; status: "applied" }
  | { error: PlanOperationError | "unknownOption"; status: "invalid" }
  | { status: "notFound" | "unauthorized" };

const EXAM_CHOICE_NOTE = "The learner picked the options they take of one of the exam's choices.";

export async function findOfferedChoices({
  choices,
  goal,
  db = prisma,
}: {
  choices: readonly ExamChoice[];
  goal: Pick<Goal, "examBlueprintId">;
  db?: Pick<TransactionClient, "examBlueprint">;
}): Promise<ExamChoice[] | null> {
  const blueprint = goal.examBlueprintId
    ? await db.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
    : null;

  if (!blueprint) {
    return null;
  }

  const { structure } = readBlueprintContent(blueprint);

  const offered = choices.flatMap((choice) => {
    const options = findChosenOptions({ choice, structure });
    return options ? [{ group: choice.group, subjects: options.map((option) => option.name) }] : [];
  });

  return offered.length === choices.length ? offered : null;
}

async function applyChoices({
  choices,
  context,
}: {
  choices: readonly ExamChoice[];
  context: PlanContext;
}): Promise<ExamChoiceResult> {
  const current = context.state.settings.examChoices;

  const changed = choices.filter((choice) => !current.some((item) => isSamePick(item, choice)));

  if (changed.length === 0) {
    return { change: null, status: "applied" };
  }

  const { goal } = context;

  const result = await applyChangeNow({
    context,
    extraWrites: (tx) => oweGoalLessons({ db: tx, goalId: goal.id, userId: goal.userId }),
    followToday: true,
    operations: changed.map((choice) => ({ kind: "setExamChoice" as const, ...choice })),
    reason: EXAM_CHOICE_NOTE,
    source: "learner",
  });

  if (result.status === "invalid") {
    return result;
  }

  const change = result.status === "saved" ? null : await loadPlanChangeView(result.changeId);
  return { change, status: "applied" };
}

export async function chooseExamOption({
  goalId,
  input,
}: {
  goalId: string;
  input: ExamChoiceInput;
}): Promise<ExamChoiceResult> {
  const owned = await findOwnedGoal(goalId);

  if (owned.status !== "ready") {
    return owned;
  }

  return withPlanRetry(async () => {
    const context = await loadPlanAtToken(owned.goal.id, { timeZone: input.timeZone });

    if (!context) {
      return { status: "notFound" };
    }

    const offered = await findOfferedChoices({
      choices: [{ group: input.group, subjects: input.subjects }],
      goal: context.goal,
    });

    if (!offered) {
      return { error: "unknownOption", status: "invalid" };
    }

    const result = await applyChoices({ choices: offered, context });

    if (result.status === "applied") {
      trackPlanEdited({ changeKind: "setExamChoice", goalId, userId: owned.userId });
    }

    return result;
  });
}
