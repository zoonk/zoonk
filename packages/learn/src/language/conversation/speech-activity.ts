/**
 * Whether the learner is speaking, from their own microphone: their words come back as text only
 * 1.3 to 1.8 s later, too late to tell them they're heard or to keep the character's goodbye from
 * talking over them. It hears sound, not words, so a noisy room counts as speaking.
 */

/** Linear RMS of the browser's echo-cancelled microphone that a voice passes. */
const SPEECH_LEVEL = 0.02;
const SAMPLE_MS = 100;
/** A voice dips between words; below the level this long and the learner stopped. */
const HANGOVER_MS = 1000;

/** `voiced`: this sample heard a voice; `speaking` also holds the hangover after one. */
export type SpeechSample = { at: number; speaking: boolean; voiced: boolean };

function getLevel(samples: Float32Array) {
  let sum = 0;

  for (const sample of samples) {
    sum += sample * sample;
  }

  return Math.sqrt(sum / samples.length);
}

/** `context` must have been made during a tap, or Safari on iOS keeps it silent. */
export function sampleSpeech({
  context,
  onSample,
  stream,
}: {
  context: AudioContext;
  onSample: (sample: SpeechSample) => void;
  stream: MediaStream;
}) {
  const source = context.createMediaStreamSource(stream);
  const analyser = context.createAnalyser();
  analyser.fftSize = 2048;
  source.connect(analyser);
  const samples = new Float32Array(analyser.fftSize);
  let voicedAt: number | null = null;

  const timer = setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    const at = Date.now();

    const voiced = getLevel(samples) >= SPEECH_LEVEL;

    if (voiced) {
      voicedAt = at;
    }

    onSample({ at, speaking: voicedAt !== null && at - voicedAt < HANGOVER_MS, voiced });
  }, SAMPLE_MS);

  return () => {
    clearInterval(timer);
    source.disconnect();
  };
}
