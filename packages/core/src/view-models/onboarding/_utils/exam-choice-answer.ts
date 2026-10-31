import "server-only";
import { type Goal, type TransactionClient } from "@zoonk/db";
import { findOfferedChoices } from "../../../exams/choices/choose-exam-option";
import { findNamedChoices } from "../../../exams/choices/named-exam-choices";
import { examStructureSchema } from "../../../library/exams/blueprint-contract";
import { type PlanOperation } from "../../../plans/plan-contract";
import { type PlanState } from "../../../plans/planner/plan-state";
import { type OnboardingAnswerInput } from "../onboarding-contract";

async function findNamedChoiceOperations({
  goal,
  state,
  tx,
}: {
  goal: Goal;
  state: PlanState;
  tx: TransactionClient;
}): Promise<PlanOperation[]> {
  const blueprint =
    goal.kind === "exam" && goal.examBlueprintId
      ? await tx.examBlueprint.findUnique({
          select: { structure: true },
          where: { id: goal.examBlueprintId },
        })
      : null;

  const structure = examStructureSchema.safeParse(blueprint?.structure).data;

  return structure
    ? findNamedChoices({ choices: state.settings.examChoices, goal, structure }).map((choice) => ({
        kind: "setExamChoice" as const,
        ...choice,
      }))
    : [];
}

/**
 * The exam's options an answer settles: the ones the learner picked on the choice's screen, or
 * any that the words of another answer name, such as the position they typed. Null when a pick
 * isn't one the exam offers. `goal` carries the details with the answer.
 */
export async function getExamChoiceOperations({
  goal,
  input,
  state,
  tx,
}: {
  goal: Goal;
  input: OnboardingAnswerInput;
  state: PlanState;
  tx: TransactionClient;
}): Promise<PlanOperation[] | null> {
  if (input.question !== "examChoice") {
    return findNamedChoiceOperations({ goal, state, tx });
  }

  if (!input.choices) {
    return [];
  }

  const offered = await findOfferedChoices({ choices: input.choices, db: tx, goal });
  return offered && offered.map((choice) => ({ kind: "setExamChoice" as const, ...choice }));
}
