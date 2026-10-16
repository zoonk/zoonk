import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { getAdminAccess } from "../../users/get-admin-access";
import { lockPlanBlueprintWrite, writePlanInputs } from "../_utils/plan-input-write";

/**
 * Resets an exam's shared skill graph on an admin's request, the only way one is rewritten: the
 * next learner of the exam writes a new graph, which becomes the exam's. Learners' plans keep the
 * graph they were made from.
 */
export async function resetExamSkillGraphForAdmin({
  examBlueprintId,
}: {
  examBlueprintId: string;
}): Promise<{ status: "forbidden" | "notFound" | "reset" | "unauthorized" }> {
  const access = await getAdminAccess();

  if (access !== "ready") {
    return { status: access };
  }

  if (!isUuid(examBlueprintId)) {
    return { status: "notFound" };
  }

  // Plans of the exam add a picked option's skills from the shared graph.
  const { count } = await writePlanInputs(async (tx) => {
    await lockPlanBlueprintWrite(tx, examBlueprintId);
    return tx.examSkillGraph.deleteMany({ where: { examBlueprintId } });
  });

  return { status: count > 0 ? "reset" : "notFound" };
}
