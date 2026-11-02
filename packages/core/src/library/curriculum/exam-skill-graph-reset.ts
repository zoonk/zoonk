import "server-only";
import { isUuid } from "@zoonk/utils/uuid";
import { getAdminAccess } from "../../users/get-admin-access";
import { lockPlanBlueprintWrite, writePlanInputs } from "../_utils/plan-input-write";

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

  const { count } = await writePlanInputs(async (tx) => {
    await lockPlanBlueprintWrite(tx, examBlueprintId);
    return tx.examSkillGraph.deleteMany({ where: { examBlueprintId } });
  });

  return { status: count > 0 ? "reset" : "notFound" };
}
