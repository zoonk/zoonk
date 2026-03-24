"use server";

import { runBattleMode } from "@/lib/battle-runner";
import { TASKS } from "@/tasks";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";
import { revalidatePath } from "next/cache";

export async function runBattleModeAction(formData: FormData) {
  const taskId = parseFormField(formData, "taskId");

  const task = TASKS.find((t) => t.id === taskId);

  if (!task) {
    throw new Error("Task not found");
  }

  try {
    await runBattleMode(task);
    revalidatePath(`/tasks/${taskId}`);
  } catch (error) {
    logError("Error running battle mode:", error);
    throw error;
  }
}
