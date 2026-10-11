/** Speech models speak 16-bit mono PCM at 24 kHz. */
const PCM_SAMPLE_RATE = 24_000;
const BITS_PER_SAMPLE = 16;
const BITS_PER_BYTE = 8;
const PCM_BYTES_PER_SAMPLE = BITS_PER_SAMPLE / BITS_PER_BYTE;
const PCM_FORMAT = 1;
const MONO = 1;

/** Where each field of a 44-byte PCM WAV header starts. */
const HEADER = {
  bitsPerSample: 34,
  blockAlign: 32,
  byteRate: 28,
  channels: 22,
  data: 36,
  dataSize: 40,
  fmtSize: 16,
  format: 20,
  riffSize: 4,
  sampleRate: 24,
  wave: 8,
} as const;

const HEADER_BYTES = 44;
const FMT_CHUNK_BYTES = 16;
/** The RIFF size counts everything after its own 8 bytes ("RIFF" and the size). */
const RIFF_PREAMBLE_BYTES = 8;

/**
 * Wraps 16-bit mono 24 kHz PCM samples in a WAV header, the one format the speech pipeline
 * validates and encodes, for a model that streams raw samples.
 */
export function pcmToWav(pcm: Uint8Array): Uint8Array {
  const audio = new Uint8Array(HEADER_BYTES + pcm.byteLength);
  const dataView = new DataView(audio.buffer);
  const write = (offset: number, text: string) => audio.set(new TextEncoder().encode(text), offset);

  write(0, "RIFF");
  dataView.setUint32(HEADER.riffSize, audio.byteLength - RIFF_PREAMBLE_BYTES, true);
  write(HEADER.wave, "WAVEfmt ");
  dataView.setUint32(HEADER.fmtSize, FMT_CHUNK_BYTES, true);
  dataView.setUint16(HEADER.format, PCM_FORMAT, true);
  dataView.setUint16(HEADER.channels, MONO, true);
  dataView.setUint32(HEADER.sampleRate, PCM_SAMPLE_RATE, true);
  dataView.setUint32(HEADER.byteRate, PCM_SAMPLE_RATE * PCM_BYTES_PER_SAMPLE, true);
  dataView.setUint16(HEADER.blockAlign, PCM_BYTES_PER_SAMPLE, true);
  dataView.setUint16(HEADER.bitsPerSample, BITS_PER_SAMPLE, true);
  write(HEADER.data, "data");
  dataView.setUint32(HEADER.dataSize, pcm.byteLength, true);
  audio.set(pcm, HEADER_BYTES);

  return audio;
}
