const MS = 1000;

export function heardAtMs(context: AudioContext, audioTime: number): number {
  const stamp = context.getOutputTimestamp?.();

  if (stamp?.performanceTime && stamp.contextTime !== undefined) {
    return stamp.performanceTime + (audioTime - stamp.contextTime) * MS;
  }

  const outputDelay = context.outputLatency || context.baseLatency || 0;
  return performance.now() + (audioTime - context.currentTime + outputDelay) * MS;
}
