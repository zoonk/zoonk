export function comparisonPath(taskId: string, id: string) {
  return `/tasks/${taskId}/comparisons/${id}` as const;
}

export function readPath({
  id,
  packetId,
  taskId,
}: {
  id: string;
  packetId: string;
  taskId: string;
}) {
  return `/tasks/${taskId}/comparisons/${id}/read/${packetId}` as const;
}
