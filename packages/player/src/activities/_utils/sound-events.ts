export type SoundEvent = { at: number; duration?: number; midi: number };

export function together(midis: readonly number[], { at = 0, gap = 0 } = {}): SoundEvent[] {
  return midis.map((midi, index) => ({ at: at + index * gap, midi }));
}

export function oneByOne(midis: readonly number[], gap: number, at = 0): SoundEvent[] {
  return together(midis, { at, gap });
}
