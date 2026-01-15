import { Badge } from "@zoonk/ui/components/badge";
import { getModelStatus, type ModelStatus } from "@/lib/utils";

type ModelStatusBadgeProps = {
  taskId: string;
  modelId: string;
};

const labelMap: Record<ModelStatus, string> = {
  completed: "Evaluated",
  incomplete: "In progress",
  notStarted: "No outputs",
  outputsReady: "Outputs ready",
};

const variantMap: Record<
  ModelStatus,
  "default" | "secondary" | "destructive" | "outline"
> = {
  completed: "default",
  incomplete: "secondary",
  notStarted: "outline",
  outputsReady: "secondary",
};

export async function ModelStatusBadge({
  taskId,
  modelId,
}: ModelStatusBadgeProps) {
  const status = await getModelStatus(taskId, modelId);

  return <Badge variant={variantMap[status]}>{labelMap[status]}</Badge>;
}
