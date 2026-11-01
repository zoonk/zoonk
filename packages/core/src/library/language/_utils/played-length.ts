import { safeAsync } from "@zoonk/utils/error";
import {
  BufferSource,
  EncodedPacketSink,
  Input,
  type InputAudioTrack,
  MP4,
  WEBM,
} from "mediabunny";

/* oxlint-disable eslint/no-magic-numbers -- RFC 6716's table of frame lengths, section 3.1. */
/** Each Opus TOC configuration's frame length in milliseconds. */
const OPUS_FRAME_MS = [
  10, 20, 40, 60, 10, 20, 40, 60, 10, 20, 40, 60, 10, 20, 10, 20, 2.5, 5, 10, 20, 2.5, 5, 10, 20,
  2.5, 5, 10, 20, 2.5, 5, 10, 20,
];
/* oxlint-enable eslint/no-magic-numbers */

/** A TOC byte: the configuration in its top five bits, a stereo flag, the frame-count code last. */
const TOC_CONFIG_UNIT = 8;
const TOC_CODES = 4;
/** A code 3 packet counts its frames in the low six bits of its second byte. */
const OPUS_FRAME_COUNTS = 64;

/** The samples an AAC-LC frame decodes to, per channel. */
const AAC_FRAME_SAMPLES = 1024;

const MS_PER_SECOND = 1000;

function readOpusPacketMs([toc = 0, count = 0]: Uint8Array): number {
  const frames = [1, 2, 2, count % OPUS_FRAME_COUNTS][toc % TOC_CODES] ?? 0;
  return (OPUS_FRAME_MS[Math.floor(toc / TOC_CONFIG_UNIT)] ?? 0) * frames;
}

/** Every app records Opus in WebM or AAC in MP4. */
async function getPacketReader(
  track: InputAudioTrack,
): Promise<((data: Uint8Array) => number) | null> {
  const codec = await track.getCodec();

  if (codec === "opus") {
    return readOpusPacketMs;
  }

  const sampleRate = codec === "aac" ? await track.getSampleRate() : 0;

  if (sampleRate > 0) {
    const frameMs = (AAC_FRAME_SAMPLES / sampleRate) * MS_PER_SECOND;
    return () => frameMs;
  }

  return null;
}

async function sumPlayedMs(input: Input): Promise<number | null> {
  const track = await input.getPrimaryAudioTrack();
  const readPacketMs = track ? await getPacketReader(track) : null;

  if (!track || !readPacketMs) {
    return null;
  }

  let playedMs = 0;

  for await (const packet of new EncodedPacketSink(track).packets()) {
    playedMs += readPacketMs(packet.data);
  }

  return playedMs;
}

/**
 * How long a recording plays, from its frames. Speech models are paid by the minute and decode
 * every frame, so neither the client's `durationMs` nor the container's timestamps, which a crafted
 * file can shrink, measure it. Null for audio no app records.
 */
export async function readPlayedMs(bytes: Uint8Array): Promise<number | null> {
  using input = new Input({ formats: [WEBM, MP4], source: new BufferSource(bytes) });
  const { data } = await safeAsync(() => sumPlayedMs(input));

  return data;
}
