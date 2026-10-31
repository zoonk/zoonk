const PERCENT = 100;

export function hasShareMoved({ after, before }: { after: number; before: number }): boolean {
  return Math.round(before * PERCENT) !== Math.round(after * PERCENT);
}
