export type MicrophoneLevel = {
  /** Linear RMS of the newest samples: 0 is silence, 1 full scale. */
  read: () => number;
  stop: () => void;
};

/** `context` must have been made during a tap, or Safari on iOS keeps it silent. */
export function listenToLevel({
  context,
  stream,
}: {
  context: AudioContext;
  stream: MediaStream;
}): MicrophoneLevel {
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);

  return {
    read: () => {
      analyser.getFloatTimeDomainData(samples);
      let sum = 0;

      for (const sample of samples) {
        sum += sample * sample;
      }

      return Math.sqrt(sum / samples.length);
    },
    stop: () => source.disconnect(),
  };
}
