const SAMPLE_RATE = 24_000;
const BITS_PER_SAMPLE = 16;
const BITS_PER_BYTE = 8;
const BYTES_PER_SAMPLE = BITS_PER_SAMPLE / BITS_PER_BYTE;
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
 * Builds mono 24 kHz PCM WAV fixtures, the shape the speech models return, so tests exercise the
 * real WAV decoder, audibility check and MP3 encoder.
 */
export function createWavAudio({
  amplitude,
  durationSeconds,
}: {
  amplitude: number;
  durationSeconds: number;
}): Uint8Array {
  const samples = SAMPLE_RATE * durationSeconds;
  const dataBytes = samples * BYTES_PER_SAMPLE;
  const audio = new Uint8Array(HEADER_BYTES + dataBytes);
  const dataView = new DataView(audio.buffer);
  const write = (offset: number, text: string) => audio.set(new TextEncoder().encode(text), offset);

  write(0, "RIFF");
  dataView.setUint32(HEADER.riffSize, audio.byteLength - RIFF_PREAMBLE_BYTES, true);
  write(HEADER.wave, "WAVEfmt ");
  dataView.setUint32(HEADER.fmtSize, FMT_CHUNK_BYTES, true);
  dataView.setUint16(HEADER.format, PCM_FORMAT, true);
  dataView.setUint16(HEADER.channels, MONO, true);
  dataView.setUint32(HEADER.sampleRate, SAMPLE_RATE, true);
  dataView.setUint32(HEADER.byteRate, SAMPLE_RATE * BYTES_PER_SAMPLE, true);
  dataView.setUint16(HEADER.blockAlign, BYTES_PER_SAMPLE, true);
  dataView.setUint16(HEADER.bitsPerSample, BITS_PER_SAMPLE, true);
  write(HEADER.data, "data");
  dataView.setUint32(HEADER.dataSize, dataBytes, true);

  const sampleData = Int16Array.from({ length: samples }, () => amplitude);
  audio.set(new Uint8Array(sampleData.buffer), HEADER_BYTES);

  return audio;
}
