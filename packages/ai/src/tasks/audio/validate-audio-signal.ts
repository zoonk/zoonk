import { type SpeechModelName } from "./speech-models";

const MAX_AUDIO_DURATION_SECONDS = 18;
const MIN_AUDIBLE_AMPLITUDE = 0.005;
const MIN_AUDIBLE_DURATION_SECONDS = 0.04;

export type DecodedAudio = {
  channelData: Float32Array[];
  sampleRate: number;
  samplesDecoded: number;
};

/**
 * Checks one decoded sample frame across every channel. Using the strongest
 * channel avoids rejecting valid stereo audio when speech is intentionally
 * present on only one side.
 */
function isSampleFrameAudible({
  channelData,
  sampleIndex,
}: {
  channelData: Float32Array[];
  sampleIndex: number;
}): boolean {
  return channelData.some(
    (channel) => Math.abs(channel[sampleIndex] ?? 0) >= MIN_AUDIBLE_AMPLITUDE,
  );
}

/**
 * Requires at least 40 ms of meaningful signal so isolated clicks or decoder
 * noise do not count as speech. The amplitude floor sits inside the large gap
 * measured between near-silent and spoken files in the production audio corpus.
 */
function hasSustainedAudibleSignal({
  channelData,
  sampleRate,
  samplesDecoded,
}: DecodedAudio): boolean {
  const referenceChannel = channelData[0]?.subarray(0, samplesDecoded);

  if (!referenceChannel) {
    return false;
  }

  const audibleSampleFrames = referenceChannel.reduce(
    (count, _sample, sampleIndex) =>
      count + Number(isSampleFrameAudible({ channelData, sampleIndex })),
    0,
  );

  const minimumAudibleSampleFrames = Math.ceil(sampleRate * MIN_AUDIBLE_DURATION_SECONDS);

  return audibleSampleFrames >= minimumAudibleSampleFrames;
}

/**
 * Applies the provider-independent quality rules after a codec-specific parser
 * has produced normalized PCM samples. This gives every speech provider one
 * audibility and prompt-leak contract regardless of its transport details.
 */
export function assertAudibleAudioSignal({
  audio,
  model,
}: {
  audio: DecodedAudio;
  model: SpeechModelName;
}): void {
  const durationSeconds = audio.samplesDecoded / audio.sampleRate;

  if (durationSeconds > MAX_AUDIO_DURATION_SECONDS) {
    throw new Error(`${model} returned audio longer than ${MAX_AUDIO_DURATION_SECONDS} seconds`);
  }

  if (!hasSustainedAudibleSignal(audio)) {
    throw new Error(`${model} returned silent audio`);
  }
}
