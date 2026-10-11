import "server-only";
import { type Goal, prisma } from "@zoonk/db";
import { findOwnedGoal } from "../../learner/_utils/owned-goal";
import { readBlueprintContent } from "../../library/exams/save-exam-blueprint";
import { applyChangeNow } from "../../plans/_utils/apply-plan-change";
import { loadPlanChangeView } from "../../plans/_utils/owned-plan";
import { type PlanContext, loadPlanContext } from "../../plans/_utils/plan-context";
import { withPlanRetry } from "../../plans/_utils/replan";
import { type PlanChangeView } from "../../plans/plan-view-contract";
import { type PlanOperationError } from "../../plans/planner/plan-operations";
import { type ExamChoiceInput } from "./exam-choice-contract";
import { type ExamChoice, findChoiceOption } from "./exam-choices";

export type ExamChoiceResult =
  | { change: PlanChangeView | null; status: "applied" }
  | { error: PlanOperationError | "unknownOption"; status: "invalid" }
  | { status: "notFound" | "unauthorized" };

/** Not shown to the learner: the app says which option they take from the change's operations. */
const EXAM_CHOICE_NOTE = "The learner picked the option they take of one of the exam's choices.";

/**
 * The picks as the exam's notice names them, or null when one isn't an option of a choice it has
 * (or the goal has no notice): a plan never studies a subject the exam doesn't offer as an option.
 */
async function findOfferedChoices({
  choices,
  goal,
}: {
  choices: readonly ExamChoice[];
  goal: Pick<Goal, "examBlueprintId">;
}): Promise<ExamChoice[] | null> {
  const blueprint = goal.examBlueprintId
    ? await prisma.examBlueprint.findUnique({ where: { id: goal.examBlueprintId } })
    : null;

  if (!blueprint) {
    return null;
  }

  const { structure } = readBlueprintContent(blueprint);

  const offered = choices.flatMap((choice) => {
    const option = findChoiceOption({ choice, structure });
    return option ? [{ group: choice.group, subject: option.name }] : [];
  });

  return offered.length === choices.length ? offered : null;
}

/** The picks that change what the plan has, as one change the learner can undo. */
async function applyChoices({
  choices,
  context,
  followToday,
}: {
  choices: readonly ExamChoice[];
  context: PlanContext;
  followToday: boolean;
}): Promise<ExamChoiceResult> {
  const current = context.state.settings.examChoices;

  const changed = choices.filter(
    (choice) =>
      !current.some((item) => item.group === choice.group && item.subject === choice.subject),
  );

  if (changed.length === 0) {
    return { change: null, status: "applied" };
  }

  const result = await applyChangeNow({
    context,
    followToday,
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

/**
 * Keeps the options a learner takes of their exam's choices with their plan, for a goal whose
 * owner a public capability already checked: from onboarding's question or the plan. Each pick
 * must be an option the exam offers.
 */
export async function pickExamOptions({
  choices,
  followToday,
  goal,
  timeZone,
}: {
  choices: readonly ExamChoice[];
  followToday: boolean;
  goal: Goal;
  timeZone?: string | null;
}): Promise<ExamChoiceResult> {
  const offered = await findOfferedChoices({ choices, goal });

  if (!offered) {
    return { error: "unknownOption", status: "invalid" };
  }

  return withPlanRetry(async () => {
    const context = await loadPlanContext({ goal, timeZone });

    return context
      ? applyChoices({ choices: offered, context, followToday })
      : { status: "notFound" };
  });
}

/**
 * The option the learner takes of one of their exam's choices (ENEM's foreign language: English
 * or Spanish), from the plan. The plan, practice and mocks then study that option and no other of
 * the choice; picking it again changes nothing. Like any change the learner makes, it re-plans from
 * today and shows in the plan's changes with an undo.
 */
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

  return pickExamOptions({
    choices: [{ group: input.group, subject: input.subject }],
    followToday: true,
    goal: owned.goal,
    timeZone: input.timeZone,
  });
}
