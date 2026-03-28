/* oxlint-disable no-magic-numbers -- WAV header offsets are part of the RIFF spec.
 * Extracting them to named constants would make the code harder to follow,
 * not easier. The byte offsets (0, 4, 8, 12, 16, 20, 22, 24, 28, 32, 34, 36, 40, 44)
 * are the canonical WAV header layout documented at:
 * http://soundfile.sapp.org/doc/WaveFormat/
 */

const SAMPLE_RATE = 24_000;
const NUM_CHANNELS = 1;
const BITS_PER_SAMPLE = 16;
const BYTE_RATE = (SAMPLE_RATE * NUM_CHANNELS * BITS_PER_SAMPLE) / 8;
const BLOCK_ALIGN = (NUM_CHANNELS * BITS_PER_SAMPLE) / 8;
const HEADER_SIZE = 44;

/**
 * Gemini TTS outputs raw PCM audio (24kHz, 16-bit, mono).
 * Browsers can't play raw PCM, so we prepend a WAV header
 * to make it a valid .wav file.
 */
export function wrapPCMInWAV(pcmData: Uint8Array): Uint8Array {
  const wav = new Uint8Array(HEADER_SIZE + pcmData.length);
  const view = new DataView(wav.buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.codePointAt(i) ?? 0);
    }
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + pcmData.length, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, NUM_CHANNELS, true);
  view.setUint32(24, SAMPLE_RATE, true);
  view.setUint32(28, BYTE_RATE, true);
  view.setUint16(32, BLOCK_ALIGN, true);
  view.setUint16(34, BITS_PER_SAMPLE, true);
  writeString(36, "data");
  view.setUint32(40, pcmData.length, true);

  wav.set(pcmData, HEADER_SIZE);
  return wav;
}
