"use server";

import { parseFormField } from "@zoonk/utils/form";
import { revalidatePath } from "next/cache";
import { runEval } from "@/lib/eval-runner";
import { generateOutputs } from "@/lib/output-generator";
import { TASKS } from "@/tasks";

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
    console.error("Error generating outputs:", error);
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
    console.error("Error running eval:", error);
  }
}
