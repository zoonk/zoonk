"use server";

import { revalidatePath } from "next/cache";
import { runEval } from "@/lib/eval-runner";
import { TASKS } from "@/tasks";

export async function runEvalAction(taskId: string, modelId: string) {
  const task = TASKS.find((t) => t.id === taskId);

  if (!task) {
    throw new Error("Task not found");
  }

  try {
    // biome-ignore lint/suspicious/noExplicitAny: task can be of any type
    const results = await runEval(task as any, modelId);
    revalidatePath(`/tasks/${taskId}/${modelId}`);
    return { success: true, results };
  } catch (error) {
    console.error("Error running eval:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to run eval",
    };
  }
}
