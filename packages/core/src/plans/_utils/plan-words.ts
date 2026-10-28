import "server-only";
import { interpretPlanEdit } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { type PlanOperation } from "../plan-contract";
import { withTopicPart } from "./focus-topic-part";
import { type PlanContext } from "./plan-context";
import { toPlanEditInput } from "./plan-edit-input";
import { loadPlanMemory } from "./plan-memory";
import { toTopicSkills } from "./plan-topics";

type PlanEdit = Awaited<ReturnType<typeof interpretPlanEdit>>;

async function toPlanOperations({
  context,
  edit,
  request,
}: {
  context: PlanContext;
  edit: PlanEdit;
  request: string;
}): Promise<PlanOperation[]> {
  const operations = await Promise.all(
    edit.data.operations.map(async (operation): Promise<PlanOperation> => {
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

  return operations.filter(
    (operation) => operation.kind !== "addSkills" || operation.skills.length > 0,
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

  const edit = await interpretPlanEdit({ ...toPlanEditInput(context), memory, request: text });
  const operations = await toPlanOperations({ context, edit, request: text });

  return {
    data: { ...edit.data, operations, understood: edit.data.understood && operations.length > 0 },
    provenance: edit.provenance,
  };
}
