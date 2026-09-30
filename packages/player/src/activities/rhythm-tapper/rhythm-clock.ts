const MS = 1000;

/**
 * Maps the audio clock to the page's clock at the moment a sound is heard, so taps (timed by the
 * page) and clicks (timed by the audio) share one timeline, output delay included.
 */
export function heardAtMs(context: AudioContext, audioTime: number): number {
  const stamp = context.getOutputTimestamp?.();

  if (stamp?.performanceTime && stamp.contextTime !== undefined) {
    return stamp.performanceTime + (audioTime - stamp.contextTime) * MS;
  }

  const outputDelay = context.outputLatency || context.baseLatency || 0;
  return performance.now() + (audioTime - context.currentTime + outputDelay) * MS;
}
