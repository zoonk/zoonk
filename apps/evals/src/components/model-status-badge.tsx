import { type ModelStatus, getModelStatus } from "@/lib/utils";
import { Badge } from "@zoonk/ui/components/badge";

const labelMap: Record<ModelStatus, string> = {
  completed: "Evaluated",
  incomplete: "In progress",
  notStarted: "No outputs",
  outputsReady: "Outputs ready",
};

const variantMap: Record<ModelStatus, "default" | "secondary" | "destructive" | "outline"> = {
  completed: "default",
  incomplete: "secondary",
  notStarted: "outline",
  outputsReady: "secondary",
};

export async function ModelStatusBadge({ taskId, modelId }: { taskId: string; modelId: string }) {
  const status = await getModelStatus(taskId, modelId);

  return <Badge variant={variantMap[status]}>{labelMap[status]}</Badge>;
}
