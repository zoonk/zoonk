/** A note to play `at` seconds after the sound starts, ringing `duration` seconds if given. */
export type SoundEvent = { at: number; duration?: number; midi: number };

/** Notes struck at once (a chord), or strummed when `gap` spreads them a little. */
export function together(midis: readonly number[], { at = 0, gap = 0 } = {}): SoundEvent[] {
  return midis.map((midi, index) => ({ at: at + index * gap, midi }));
}

/** Notes one after another, `gap` seconds apart. */
export function oneByOne(midis: readonly number[], gap: number, at = 0): SoundEvent[] {
  return together(midis, { at, gap });
}
