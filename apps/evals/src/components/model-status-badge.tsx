import { type ModelStatus, getModelStatus } from "@/lib/utils";
import { Badge } from "@zoonk/ui/components/badge";
import { Skeleton } from "@zoonk/ui/components/skeleton";

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

/**
 * Preserves the badge's exact height while its filesystem-backed model status
 * is still being resolved.
 */
export function ModelStatusBadgeSkeleton() {
  return <Skeleton className="h-5 w-20 rounded-full" />;
}
