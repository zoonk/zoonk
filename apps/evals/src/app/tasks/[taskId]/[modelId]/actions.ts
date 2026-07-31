"use server";

import { deleteModelResults, runEval } from "@/lib/eval-runner";
import { getModelById, getModelEvaluationId, parseReasoning } from "@/lib/models";
import { generateOutputs } from "@/lib/output-generator";
import { deleteModelOutputs } from "@/lib/output-loader";
import { TASKS } from "@/tasks";
import { parseFormField } from "@zoonk/utils/form";
import { logError } from "@zoonk/utils/logger";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

/**
 * Clears both filesystem stores for the selected model and returns to the task
 * page, where the model becomes available for a completely fresh evaluation.
 */
export async function deleteModelDataAction(formData: FormData) {
  const taskId = parseFormField(formData, "taskId");
  const modelId = parseFormField(formData, "modelId");

  if (!taskId) {
    throw new Error("Task ID is required");
  }

  if (!modelId) {
    throw new Error("Model ID is required");
  }

  const task = TASKS.find((item) => item.id === taskId);

  if (!task) {
    throw new Error("Task not found");
  }

  if (!getModelById(modelId)) {
    throw new Error("Model not found");
  }

  try {
    await Promise.all([
      deleteModelOutputs({ modelId, taskId }),
      deleteModelResults({ modelId, taskId }),
    ]);
  } catch (error) {
    logError("Error deleting model data:", error);
    throw error;
  }

  revalidatePath(`/tasks/${taskId}/${encodeURIComponent(modelId)}`);
  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}`);
}

export async function generateOutputsAction(formData: FormData) {
  const taskId = parseFormField(formData, "taskId");
  const modelId = parseFormField(formData, "modelId");
  const reasoning = parseReasoning(parseFormField(formData, "reasoning"));

  const task = TASKS.find((t) => t.id === taskId);

  if (!task) {
    throw new Error("Task not found");
  }

  if (!modelId) {
    throw new Error("Model ID is required");
  }

  if (!getModelById(modelId)) {
    throw new Error("Model not found");
  }

  if (!reasoning) {
    throw new Error("Reasoning level is required");
  }

  const evaluationModelId = getModelEvaluationId({ modelId, reasoning });

  try {
    await generateOutputs(task, evaluationModelId);
  } catch (error) {
    logError("Error generating outputs:", error);
    return;
  }

  revalidatePath(`/tasks/${taskId}/${encodeURIComponent(evaluationModelId)}`);
  revalidatePath(`/tasks/${taskId}`);
  redirect(`/tasks/${taskId}/${encodeURIComponent(evaluationModelId)}`);
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

  if (!getModelById(modelId)) {
    throw new Error("Model not found");
  }

  try {
    await runEval(task, modelId);
    revalidatePath(`/tasks/${taskId}/${encodeURIComponent(modelId)}`);
    revalidatePath(`/tasks/${taskId}`);
  } catch (error) {
    logError("Error running eval:", error);
  }
}
