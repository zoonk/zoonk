import decodeWav from "@audio/decode-wav";
import { createMp3Encoder } from "wasm-media-encoders";
import { type SpeechModelName } from "./speech-models";
import { type DecodedAudio, assertAudibleAudioSignal } from "./validate-audio-signal";

const MP3_BITRATE_KBPS = 48;
const MP3_SAMPLE_RATE = 24_000;

type EncodableAudio = DecodedAudio & { channelCount: 1 | 2 };

/**
 * Rejects empty or unsupported provider WAV shapes before they reach the
 * encoder. TTS responses should be mono, but accepting stereo keeps this
 * boundary safe if a provider changes its channel layout without changing the
 * WAV contract.
 */
function getChannelCount({
  channelData,
  model,
}: {
  channelData: Float32Array[];
  model: SpeechModelName;
}): 1 | 2 {
  const channelCount = channelData.length;

  if (channelCount === 1 || channelCount === 2) {
    return channelCount;
  }

  throw new Error(`${model} returned invalid WAV audio`);
}

/**
 * Decodes provider WAV into normalized samples and verifies that every channel
 * represents the same non-empty timeline. Wrapping parser errors here gives
 * the retry layer one stable provider failure regardless of the malformed WAV.
 */
async function decodeWavAudio({
  audio,
  model,
}: {
  audio: Uint8Array;
  model: SpeechModelName;
}): Promise<EncodableAudio> {
  try {
    const decodedAudio = await decodeWav(audio);
    const channelCount = getChannelCount({ channelData: decodedAudio.channelData, model });
    const samplesDecoded = decodedAudio.channelData[0]?.length ?? 0;

    const channelsHaveMatchingLengths = decodedAudio.channelData.every(
      (channel) => channel.length === samplesDecoded,
    );

    if (decodedAudio.sampleRate <= 0 || samplesDecoded === 0 || !channelsHaveMatchingLengths) {
      throw new Error(`${model} returned invalid WAV audio`);
    }

    return { ...decodedAudio, channelCount, samplesDecoded };
  } catch (error) {
    throw new Error(`${model} returned invalid WAV audio`, { cause: error });
  }
}

/**
 * Copies encoder-owned chunks into one stable upload buffer. The encoder reuses
 * its WASM memory between encode and finalize, so the caller copies each chunk
 * before invoking the next encoder operation.
 */
function combineMp3Chunks({
  finalChunk,
  firstChunk,
}: {
  finalChunk: Uint8Array;
  firstChunk: Uint8Array;
}): Uint8Array {
  const audio = new Uint8Array(firstChunk.byteLength + finalChunk.byteLength);
  audio.set(firstChunk);
  audio.set(finalChunk, firstChunk.byteLength);
  return audio;
}

/**
 * Validates provider WAV and encodes it as a compact 48 kbps MP3. Keeping one
 * final codec avoids shipping separate decoder paths and gives storage and
 * playback a consistent media contract.
 */
export async function convertWavToMp3({
  audio,
  model,
}: {
  audio: Uint8Array;
  model: SpeechModelName;
}): Promise<Uint8Array> {
  const decodedAudio = await decodeWavAudio({ audio, model });
  assertAudibleAudioSignal({ audio: decodedAudio, model });

  const encoder = await createMp3Encoder();

  encoder.configure({
    bitrate: MP3_BITRATE_KBPS,
    channels: decodedAudio.channelCount,
    outputSampleRate: MP3_SAMPLE_RATE,
    sampleRate: decodedAudio.sampleRate,
  });

  const firstChunk = Uint8Array.from(encoder.encode(decodedAudio.channelData));
  const finalChunk = Uint8Array.from(encoder.finalize());
  return combineMp3Chunks({ finalChunk, firstChunk });
}
