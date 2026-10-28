/**
 * What the page's main region showed, frame by frame: whether a loading skeleton was in it and how
 * many words it read. The probe records a frame when either changes; times are ms since the
 * document's navigation started.
 */
export type MainFrame = { at: number; skeleton: boolean; words: number };

/** Share of the settled page's words a frame needs to count as showing its content. */
const CONTENT_SHARE = 0.9;

/** Below this share of the settled page's words, a frame lost the content it had shown. */
const LOST_SHARE = 0.5;

function hasContent(frame: MainFrame, settled: number): boolean {
  return !frame.skeleton && frame.words > 0 && frame.words >= settled * CONTENT_SHARE;
}

/** The words the page settled on: its last frame's. */
function settledWords(frames: MainFrame[]): number {
  return frames.at(-1)?.words ?? 0;
}

/**
 * When the page first showed its content from `from` on: no skeleton in its main region and
 * nearly all the words it settled on. Null when it never did.
 */
export function contentFrameAt(frames: MainFrame[], from: number): number | null {
  const settled = settledWords(frames);
  return frames.find((frame) => frame.at >= from && hasContent(frame, settled))?.at ?? null;
}

/**
 * How many times the page showed its content from `from` on, then a skeleton or most of its words
 * gone, then its content again: a flash a learner sees as the page reloading itself.
 */
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

/** The words the first paint showed in the page's main region (from `fcp` on); null without one. */
export function shellWords(frames: MainFrame[], fcp: number | null): number | null {
  if (fcp === null) {
    return null;
  }

  // The probe records a frame only when it changes, so the shell is the last frame at the paint.
  const atPaint =
    frames.findLast((frame) => frame.at <= fcp) ?? frames.find((frame) => frame.at >= fcp);

  return atPaint?.words ?? null;
}

/** What a load's frames say: when its content showed, its flashes, and its first paint's words. */
export function measureFrames(frames: MainFrame[], fcp: number | null) {
  return {
    contentMs: contentFrameAt(frames, 0),
    flashes: countFlashes(frames, 0),
    shellWords: shellWords(frames, fcp),
  };
}
