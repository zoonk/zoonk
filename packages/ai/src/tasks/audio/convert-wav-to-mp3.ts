import decodeWav from "@audio/decode-wav";
import { createMp3Encoder } from "wasm-media-encoders";
import { type SpeechModelName } from "./speech-models";
import { type DecodedAudio, assertAudibleAudioSignal } from "./validate-audio-signal";

const MP3_BITRATE_KBPS = 48;
const MP3_SAMPLE_RATE = 24_000;

export type EncodableAudio = DecodedAudio & { channelCount: 1 | 2 };

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

function decodeWavAudio({
  audio,
  model,
}: {
  audio: Uint8Array;
  model: SpeechModelName;
}): EncodableAudio {
  try {
    const decodedAudio = decodeWav(audio);
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

/** The encoder reuses its WASM memory between encode and finalize, so chunks are copied first. */
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

export function decodeSpeechWav({
  audio,
  maxSeconds,
  model,
}: {
  audio: Uint8Array;
  maxSeconds: number;
  model: SpeechModelName;
}): EncodableAudio {
  const decodedAudio = decodeWavAudio({ audio, model });
  assertAudibleAudioSignal({ audio: decodedAudio, maxSeconds, model });
  return decodedAudio;
}

export async function encodeMp3(
  decodedAudio: EncodableAudio,
): Promise<{ audio: Uint8Array; durationSeconds: number }> {
  const encoder = await createMp3Encoder();

  encoder.configure({
    bitrate: MP3_BITRATE_KBPS,
    channels: decodedAudio.channelCount,
    outputSampleRate: MP3_SAMPLE_RATE,
    sampleRate: decodedAudio.sampleRate,
  });

  const firstChunk = Uint8Array.from(encoder.encode(decodedAudio.channelData));
  const finalChunk = Uint8Array.from(encoder.finalize());

  return {
    audio: combineMp3Chunks({ finalChunk, firstChunk }),
    durationSeconds: decodedAudio.samplesDecoded / decodedAudio.sampleRate,
  };
}

export async function convertWavToMp3(input: {
  audio: Uint8Array;
  maxSeconds: number;
  model: SpeechModelName;
}): Promise<{ audio: Uint8Array; durationSeconds: number }> {
  const decoded = decodeSpeechWav(input);
  return encodeMp3(decoded);
}
