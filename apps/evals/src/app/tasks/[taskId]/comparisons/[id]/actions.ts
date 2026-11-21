"use server";

import { importAdjudication } from "@/lib/comparisons/adjudications";
import { ownerPackets } from "@/lib/comparisons/packets";
import { adjudicationSchema, identifier } from "@/lib/comparisons/schemas";
import { listComparisons, loadComparison } from "@/lib/comparisons/storage";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";
import { revalidatePath } from "next/cache";
import { comparisonPath, readPath } from "../_utils/paths";

export type RulingResult = { error: string } | null;

/** Saves the owner's ruling on a case the readers left unresolved; the engine decides whether it may. */
export async function ruleOnCaseAction(formData: FormData): Promise<RulingResult> {
  const taskId = identifier.safeParse(parseFormField(formData, "taskId"));
  const id = identifier.safeParse(parseFormField(formData, "comparisonId"));

  const direction = adjudicationSchema.shape.direction.safeParse(
    parseFormField(formData, "direction"),
  );

  const ids = taskId.success ? await listComparisons(taskId.data) : [];

  if (!taskId.success || !id.success || !ids.includes(id.data)) {
    return { error: "This comparison no longer exists." };
  }

  if (!direction.success) {
    return { error: "Choose who serves the learner better." };
  }

  const caseId = parseFormField(formData, "caseId") ?? "";

  try {
    await importAdjudication({
      caseId,
      direction: direction.data,
      id: id.data,
      reason: parseFormField(formData, "reason") ?? "",
      taskId: taskId.data,
    });
  } catch (error) {
    logError("Error saving a ruling:", error);
    return { error: "Your ruling couldn’t be saved. Reload the page and try again." };
  }

  const { manifest } = await loadComparison(taskId.data, id.data);

  ownerPackets(manifest)
    .filter((packet) => packet.mapping[0]?.caseId === caseId)
    .forEach((packet) =>
      revalidatePath(readPath({ id: id.data, packetId: packet.id, taskId: taskId.data })),
    );

  revalidatePath(comparisonPath(taskId.data, id.data));
  revalidatePath(`/tasks/${taskId.data}`);

  return null;
}
