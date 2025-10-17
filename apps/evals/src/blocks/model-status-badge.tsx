import { Badge } from "@zoonk/ui/components/badge";
import { getTaskResults } from "@/lib/eval-runner";
import { getTotalTestCases } from "@/tasks";

type ModelStatus = "completed" | "incomplete" | "notStarted";

interface ModelStatusBadgeProps {
  taskId: string;
  modelId: string;
}

const labelMap: Record<ModelStatus, string> = {
  completed: "Completed",
  incomplete: "In progress",
  notStarted: "Not started",
};

const variantMap: Record<
  ModelStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  completed: "default",
  incomplete: "secondary",
  notStarted: "outline",
};

export async function getModelStatus(
  taskId: string,
  modelId: string,
): Promise<ModelStatus> {
  const results = await getTaskResults(taskId, modelId);
  const resultsCount = results?.results.length ?? 0;
  const totalTestCases = getTotalTestCases(taskId);

  if (resultsCount >= totalTestCases && totalTestCases > 0) {
    return "completed";
  }

  if (resultsCount > 0 && resultsCount < totalTestCases) {
    return "incomplete";
  }

  return "notStarted";
}

export async function ModelStatusBadge({
  taskId,
  modelId,
}: ModelStatusBadgeProps) {
  const status = await getModelStatus(taskId, modelId);

  return <Badge variant={variantMap[status]}>{labelMap[status]}</Badge>;
}
