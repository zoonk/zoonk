import { notFound, redirect } from "next/navigation";
import { EVAL_MODELS } from "@/lib/models";
import { TASKS } from "@/tasks";
import { TaskPageWithModel } from "./task-page-with-model";

interface TaskModelPageProps {
  params: Promise<{ taskId: string; modelId: string }>;
}

export default async function TaskModelPage({ params }: TaskModelPageProps) {
  const { taskId, modelId } = await params;
  const task = TASKS.find((t) => t.id === taskId);

  if (!task) {
    notFound();
  }

  // Decode the modelId (it comes URL-encoded)
  const decodedModelId = decodeURIComponent(modelId);

  // Validate model exists
  const model = EVAL_MODELS.find((m) => m.id === decodedModelId);

  if (!model) {
    // Redirect to task page without model
    redirect(`/tasks/${taskId}`);
  }

  return (
    <TaskPageWithModel
      taskId={task.id}
      taskName={task.name}
      modelId={decodedModelId}
    />
  );
}
