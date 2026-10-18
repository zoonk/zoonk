const SAMPLE_RATE = 8000;
const TONE_HZ = 440;
const AMPLITUDE = 8000;

/** A 16-bit mono PCM WAV file's header: where each field starts, and the values that don't vary. */
const WAV = {
  bitsPerSample: 16,
  bytesPerSample: 2,
  fields: {
    audioFormat: 20,
    bitsPerSample: 34,
    blockAlign: 32,
    byteRate: 28,
    channels: 22,
    data: 36,
    dataSize: 40,
    fmtSize: 16,
    format: 8,
    riffSize: 4,
    sampleRate: 24,
  },
  fmtSize: 16,
  headerBytes: 44,
} as const;

/** Long enough to answer the first question while it plays, short enough to wait for its end. */
export const RECORDING_MS = 6000;

/** A short tone as a WAV data URL: a recording the browser really plays to its end. */
export function toneUrl(seconds: number): string {
  const { bytesPerSample, fields, headerBytes } = WAV;
  const samples = Math.round(SAMPLE_RATE * seconds);
  const bytes = Buffer.alloc(headerBytes + samples * bytesPerSample);

  bytes.write("RIFF", 0);
  bytes.writeUInt32LE(bytes.byteLength - fields.format, fields.riffSize);
  bytes.write("WAVEfmt ", fields.format);
  bytes.writeUInt32LE(WAV.fmtSize, fields.fmtSize);
  bytes.writeUInt16LE(1, fields.audioFormat);
  bytes.writeUInt16LE(1, fields.channels);
  bytes.writeUInt32LE(SAMPLE_RATE, fields.sampleRate);
  bytes.writeUInt32LE(SAMPLE_RATE * bytesPerSample, fields.byteRate);
  bytes.writeUInt16LE(bytesPerSample, fields.blockAlign);
  bytes.writeUInt16LE(WAV.bitsPerSample, fields.bitsPerSample);
  bytes.write("data", fields.data);
  bytes.writeUInt32LE(samples * bytesPerSample, fields.dataSize);

  for (let index = 0; index < samples; index += 1) {
    const value = Math.sin((2 * Math.PI * TONE_HZ * index) / SAMPLE_RATE) * AMPLITUDE;
    bytes.writeInt16LE(Math.round(value), headerBytes + index * bytesPerSample);
  }

  return `data:audio/wav;base64,${bytes.toString("base64")}`;
}
