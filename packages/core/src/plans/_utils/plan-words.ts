import "server-only";
import { interpretPlanEdit } from "@zoonk/ai/tasks/v2/plans/edit-intent";
import { toProvenanceData } from "../../library/_utils/library-rows";
import { type PlanOperation } from "../plan-contract";
import { withTopicPart } from "./focus-topic-part";
import { type PlanContext } from "./plan-context";
import { toPlanEditInput } from "./plan-edit-input";
import { loadPlanMemory } from "./plan-memory";
import { toTopicSkills } from "./plan-topics";

type PlanEdit = Awaited<ReturnType<typeof interpretPlanEdit>>;

/**
 * The planner's operations for the changes the words asked for: topics to add become the Library
 * skills that teach them (`toTopicSkills`), added as the learner's next work, and a focus on a
 * one-subject plan's only area takes the topics the words name (`withTopicPart`).
 */
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
        provenance: toProvenanceData(edit.provenance),
        topics: operation.topics,
      });

      return { kind: "addSkills", skills };
    }),
  );

  return operations.filter(
    (operation) => operation.kind !== "addSkills" || operation.skills.length > 0,
  );
}

/**
 * Reads a learner's plain words about their plan ("less on weekends", "focus on math", "add SQL")
 * into the changes the plan's controls make, with one sentence saying what changes. What memory
 * holds about the learner's goals and routine fills in what the words leave open ("less on my
 * late days").
 */
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
