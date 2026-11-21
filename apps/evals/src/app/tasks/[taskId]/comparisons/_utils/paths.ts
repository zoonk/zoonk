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

/** A sealed picture, named by its hash so its address never says which model drew it. */
export function imagePath({ hash, id, taskId }: { hash: string; id: string; taskId: string }) {
  return `/tasks/${taskId}/comparisons/${id}/images/${hash}` as const;
}
