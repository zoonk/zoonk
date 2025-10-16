"use server";

import { revalidatePath } from "next/cache";
import { runEval } from "@/lib/eval-runner";
import { TASKS } from "@/tasks";

export async function runEvalAction(formData: FormData) {
  const taskId = String(formData.get("taskId") || "").trim();
  const modelId = String(formData.get("modelId") || "").trim();

  const task = TASKS.find((t) => t.id === taskId);

  if (!task) {
    throw new Error("Task not found");
  }

  try {
    await runEval(task, modelId);
    revalidatePath(`/tasks/${taskId}/${modelId}`);
  } catch (error) {
    console.error("Error running eval:", error);
  }
}
