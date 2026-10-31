/**
 * The probe records a frame when the main region's skeleton or word count changes; times are ms
 * since the document's navigation started.
 */
export type MainFrame = { at: number; skeleton: boolean; words: number };

const CONTENT_SHARE = 0.9;

const LOST_SHARE = 0.5;

function hasContent(frame: MainFrame, settled: number): boolean {
  return !frame.skeleton && frame.words > 0 && frame.words >= settled * CONTENT_SHARE;
}

function settledWords(frames: MainFrame[]): number {
  return frames.at(-1)?.words ?? 0;
}

export function contentFrameAt(frames: MainFrame[], from: number): number | null {
  const settled = settledWords(frames);
  return frames.find((frame) => frame.at >= from && hasContent(frame, settled))?.at ?? null;
}

export function countFlashes(frames: MainFrame[], from: number): number {
  const settled = settledWords(frames);
  let shown = false;
  let lost = false;
  let flashes = 0;

  for (const frame of frames.filter((candidate) => candidate.at >= from)) {
    if (hasContent(frame, settled)) {
      flashes += lost ? 1 : 0;
      shown = true;
      lost = false;
    } else if (shown && (frame.skeleton || frame.words < settled * LOST_SHARE)) {
      lost = true;
    }
  }

  return flashes;
}

export function shellWords(frames: MainFrame[], fcp: number | null): number | null {
  if (fcp === null) {
    return null;
  }

  // The probe records a frame only when it changes, so the shell is the last frame at the paint.
  const atPaint =
    frames.findLast((frame) => frame.at <= fcp) ?? frames.find((frame) => frame.at >= fcp);

  return atPaint?.words ?? null;
}

export function measureFrames(frames: MainFrame[], fcp: number | null) {
  return {
    contentMs: contentFrameAt(frames, 0),
    flashes: countFlashes(frames, 0),
    shellWords: shellWords(frames, fcp),
  };
}
