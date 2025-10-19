import { Badge } from "@zoonk/ui/components/badge";
import { getModelStatus, type ModelStatus } from "@/lib/utils";

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

export async function ModelStatusBadge({
  taskId,
  modelId,
}: ModelStatusBadgeProps) {
  const status = await getModelStatus(taskId, modelId);

  return <Badge variant={variantMap[status]}>{labelMap[status]}</Badge>;
}
