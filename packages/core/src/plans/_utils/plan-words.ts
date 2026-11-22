import "server-only";
import { interpretPlanEdit } from "@zoonk/ai/tasks/plans/edit-intent";
import { MAX_DAILY_MINUTES, MIN_DAILY_MINUTES } from "../daily-minutes";
import { type PlanOperation } from "../plan-contract";
import { withTopicPart } from "./focus-topic-part";
import { type PlanContext } from "./plan-context";
import { toPlanEditInput } from "./plan-edit-input";
import { loadPlanMemory } from "./plan-memory";
import { getPlanSummaryBasis, readFreshPlanSummary } from "./plan-summary";
import { toTopicSkills } from "./plan-topics";

type PlanEdit = Awaited<ReturnType<typeof interpretPlanEdit>>;

async function toPlanOperations({
  context,
  edit,
  request,
  examStrategy,
}: {
  context: PlanContext;
  edit: PlanEdit;
  examStrategy: PlanOperation | undefined;
  request: string;
}): Promise<PlanOperation[]> {
  const operations = await Promise.all(
    edit.data.operations.map(async (operation): Promise<PlanOperation | undefined> => {
      if (operation.kind === "addExamStrategy") {
        return examStrategy;
      }

      if (operation.kind === "focusAreas") {
        return withTopicPart({ context, operation, request });
      }

      if (operation.kind !== "addTopics") {
        return operation;
      }

      const skills = await toTopicSkills({
        context,
        startDate: operation.startDate,
        topics: operation.topics,
      });

      return { kind: "addSkills", skills };
    }),
  );

  return operations.filter((operation): operation is PlanOperation =>
    Boolean(operation && (operation.kind !== "addSkills" || operation.skills.length > 0)),
  );
}

export async function interpretPlanWords({
  context,
  text,
}: {
  context: PlanContext;
  text: string;
}) {
  const memory = await loadPlanMemory({
    goal: context.goal,
    need: `A change to the study plan: ${text}`,
  });

  const summary = readFreshPlanSummary({
    basis: getPlanSummaryBasis(context),
    value: context.plan.summary,
  });

  const examStrategy = summary?.advice.extraOffer?.operations.find(
    (operation) => operation.kind === "setExtras",
  );

  const edit = await interpretPlanEdit({
    dailyMinutesLimits: { max: MAX_DAILY_MINUTES, min: MIN_DAILY_MINUTES },
    examStrategyOffered: examStrategy !== undefined,
    ...toPlanEditInput(context),
    memory,
    request: text,
  });

  const operations = await toPlanOperations({ context, edit, examStrategy, request: text });

  return {
    data: { ...edit.data, operations, understood: edit.data.understood && operations.length > 0 },
    provenance: edit.provenance,
  };
}
