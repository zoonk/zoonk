import { type EncodableAudio } from "./convert-wav-to-mp3";

/**
 * The longest text one speech call reads: about half a minute of speech, short enough that a voice
 * stays steady and a failed call costs little to redo.
 */
const MAX_PART_CHARACTERS = 500;

/** The pause between two speakers' turns, and between the parts of one long turn. */
const TURN_PAUSE_SECONDS = 0.6;
const PART_PAUSE_SECONDS = 0.25;

/**
 * Splits a turn into parts of whole sentences, each at most `MAX_PART_CHARACTERS` long; a single
 * sentence longer than that stays whole. Sentence breaks follow the language (`Intl.Segmenter`),
 * so languages written without spaces split too.
 */
export function splitSpokenText({ locale, text }: { locale: string; text: string }): string[] {
  const sentences = Array.from(
    new Intl.Segmenter(locale, { granularity: "sentence" }).segment(text.trim()),
    (sentence) => sentence.segment,
  );

  const parts: string[] = [];

  for (const sentence of sentences) {
    const last = parts.at(-1);

    if (last !== undefined && last.length + sentence.length <= MAX_PART_CHARACTERS) {
      parts[parts.length - 1] = last + sentence;
    } else {
      parts.push(sentence);
    }
  }

  return parts.map((part) => part.trim()).filter(Boolean);
}

/** The first channel of a part: speech is mono, and a stereo part's left side carries it too. */
function getSamples(audio: EncodableAudio): Float32Array {
  return audio.channelData[0]?.subarray(0, audio.samplesDecoded) ?? new Float32Array();
}

/**
 * Joins voiced parts in order into one mono recording, with a longer pause where the speaker
 * changes (`turn`) than between the parts of one turn. Every part must share one sample rate.
 */
export function joinSpeech(
  parts: readonly { audio: EncodableAudio; turn: number }[],
): EncodableAudio {
  const [first] = parts;

  if (!first) {
    throw new Error("A recording needs at least one voiced part.");
  }

  const { sampleRate } = first.audio;

  if (parts.some((part) => part.audio.sampleRate !== sampleRate)) {
    throw new Error("Voiced parts came back at different sample rates.");
  }

  const pieces = parts.flatMap((part, index) => {
    const previous = parts[index - 1];

    if (!previous) {
      return [getSamples(part.audio)];
    }

    const pause = previous.turn === part.turn ? PART_PAUSE_SECONDS : TURN_PAUSE_SECONDS;
    return [new Float32Array(Math.round(pause * sampleRate)), getSamples(part.audio)];
  });

  const samples = new Float32Array(pieces.reduce((total, piece) => total + piece.length, 0));

  pieces.reduce((offset, piece) => {
    samples.set(piece, offset);
    return offset + piece.length;
  }, 0);

  return { channelCount: 1, channelData: [samples], sampleRate, samplesDecoded: samples.length };
}
