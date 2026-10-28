const clock: { context: AudioContext | null } = { context: null };

export function getActivityAudioContext(): AudioContext {
  clock.context ??= new AudioContext();
  return clock.context;
}

/** Starts the shared clock; call it from a tap or key press. */
export async function startActivityAudio(): Promise<AudioContext> {
  const context = getActivityAudioContext();

  if (context.state === "suspended") {
    await context.resume();
  }

  return context;
}

const CLICK_SECONDS = 0.05;
const CLICK_ATTACK = 0.002;
const CLICK_FLOOR = 0.0001;

export function scheduleClick({
  context,
  kind,
  time,
}: {
  context: AudioContext;
  kind: "accent" | "beat" | "hit";
  time: number;
}): void {
  const frequency = { accent: 1760, beat: 1320, hit: 2400 }[kind];
  const peak = { accent: 0.5, beat: 0.3, hit: 0.6 }[kind];
  const oscillator = context.createOscillator();
  const gain = context.createGain();

  oscillator.type = kind === "hit" ? "triangle" : "sine";
  oscillator.frequency.setValueAtTime(frequency, time);
  gain.gain.setValueAtTime(CLICK_FLOOR, time);
  gain.gain.exponentialRampToValueAtTime(peak, time + CLICK_ATTACK);
  gain.gain.exponentialRampToValueAtTime(CLICK_FLOOR, time + CLICK_SECONDS);
  oscillator.connect(gain).connect(context.destination);
  oscillator.start(time);
  oscillator.stop(time + CLICK_SECONDS);
}
