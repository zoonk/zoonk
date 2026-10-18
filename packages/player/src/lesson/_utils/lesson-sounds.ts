type LessonSound = "correct" | "finish";

/** Notes in Hz, so no audio files ship with the player: E5 and A5, then a C major arpeggio. */
const E5 = 659.25;
const A5 = 880;
const C5 = 523.25;
const G5 = 783.99;

const NOTES: Record<LessonSound, number[]> = { correct: [E5, A5], finish: [C5, E5, G5] };
const NOTE_SECONDS = 0.12;
/** Each note swells quickly and fades over twice its length, so the chime sounds soft. */
const ATTACK_SECONDS = 0.03;
const PEAK_GAIN = 0.12;
const SILENT_GAIN = 0.0001;

let context: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof globalThis.AudioContext !== "function") {
    return null;
  }

  context ??= new AudioContext();
  return context;
}

function playNote({
  audio,
  frequency,
  startAt,
}: {
  audio: AudioContext;
  frequency: number;
  startAt: number;
}) {
  const oscillator = audio.createOscillator();
  const gain = audio.createGain();

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, startAt);
  gain.gain.setValueAtTime(SILENT_GAIN, startAt);
  gain.gain.exponentialRampToValueAtTime(PEAK_GAIN, startAt + ATTACK_SECONDS);
  gain.gain.exponentialRampToValueAtTime(SILENT_GAIN, startAt + NOTE_SECONDS * 2);

  oscillator.connect(gain).connect(audio.destination);
  oscillator.start(startAt);
  oscillator.stop(startAt + NOTE_SECONDS * 2);
}

/**
 * A soft chime for a right answer and a short rising one for finishing a lesson. It follows a user
 * action, so browsers allow the audio, and it stays quiet when the device has no audio support.
 */
export function playLessonSound(sound: LessonSound) {
  const audio = getAudioContext();

  if (!audio) {
    return;
  }

  void audio.resume();

  NOTES[sound].forEach((frequency, index) => {
    playNote({ audio, frequency, startAt: audio.currentTime + index * NOTE_SECONDS });
  });
}
