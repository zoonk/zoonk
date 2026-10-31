const TEMPO_STEP = 5;
const SLOWEST_SHARE = 0.6;
const SLOWER_SHARE = 0.8;
const SLOWER_SHARES = [SLOWEST_SHARE, SLOWER_SHARE] as const;

function headerValue(notation: string, field: string): string | null {
  const match = new RegExp(`^${field}:(.*)$`, "mu").exec(notation);
  const value = match?.[1]?.trim();
  return value || null;
}

export function notationHeader(notation: string): {
  composer: string | null;
  title: string | null;
} {
  return { composer: headerValue(notation, "C"), title: headerValue(notation, "T") };
}

export function notationToDraw(notation: string): string {
  const body = notation
    .split("\n")
    .filter((line) => !/^[TC]:/u.test(line))
    .join("\n");

  return /^X:/mu.test(body) ? body : `X:1\n${body}`;
}

export function practiceTempos(tempo: number): number[] {
  const slower = SLOWER_SHARES.map(
    (share) => Math.round((tempo * share) / TEMPO_STEP) * TEMPO_STEP,
  );

  return [...new Set([...slower, tempo])].toSorted((a, b) => a - b);
}
