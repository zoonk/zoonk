"use server";

import { runEval } from "@/lib/eval-runner";
import { generateOutputs } from "@/lib/output-generator";
import { TASKS } from "@/tasks";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";
import { revalidatePath } from "next/cache";

export async function generateOutputsAction(formData: FormData) {
  const taskId = parseFormField(formData, "taskId");
  const modelId = parseFormField(formData, "modelId");

  const task = TASKS.find((t) => t.id === taskId);

  if (!task) {
    throw new Error("Task not found");
  }

  if (!modelId) {
    throw new Error("Model ID is required");
  }

  try {
    await generateOutputs(task, modelId);
    revalidatePath(`/tasks/${taskId}/${modelId}`);
    revalidatePath(`/tasks/${taskId}`);
  } catch (error) {
    logError("Error generating outputs:", error);
  }
}

export async function runEvalAction(formData: FormData) {
  const taskId = parseFormField(formData, "taskId");
  const modelId = parseFormField(formData, "modelId");

  const task = TASKS.find((t) => t.id === taskId);

  if (!task) {
    throw new Error("Task not found");
  }

  if (!modelId) {
    throw new Error("Model ID is required");
  }

  try {
    await runEval(task, modelId);
    revalidatePath(`/tasks/${taskId}/${modelId}`);
  } catch (error) {
    logError("Error running eval:", error);
  }
}
