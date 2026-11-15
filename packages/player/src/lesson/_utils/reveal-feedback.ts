type Span = { bottom: number; top: number };

const MARGIN = 16;

function getWholeFeedbackDelta(feedback: Span, visible: Span): number {
  if (feedback.top < visible.top) {
    return feedback.top - visible.top - MARGIN;
  }

  if (feedback.bottom > visible.bottom) {
    return Math.min(feedback.bottom - visible.bottom + MARGIN, feedback.top - visible.top - MARGIN);
  }

  return 0;
}

/**
 * How far a checked screen scrolls so its feedback is in sight. It shows the whole feedback, unless
 * that scrolls the screen's title away while less would still show the verdict: then it stops with
 * the title first on screen. A chip over the title is either whole or gone, never a sliver under
 * the top bar.
 */
export function getRevealDelta({
  chip,
  feedback,
  titleTop,
  verdict,
  visible,
}: {
  chip: Span | null;
  feedback: Span;
  titleTop: number | null;
  verdict: Span | null;
  visible: Span;
}): number {
  const whole = getWholeFeedbackDelta(feedback, visible);

  if (titleTop === null || !verdict) {
    return whole;
  }

  const roomOverTitle = chip ? Math.min(MARGIN, titleTop - chip.bottom) : MARGIN;
  const keepsTitle = titleTop - visible.top - roomOverTitle;

  if (whole > keepsTitle) {
    const showsVerdict = verdict.bottom - visible.bottom <= keepsTitle;
    return keepsTitle >= 0 && showsVerdict ? keepsTitle : whole;
  }

  const cutsChip = chip !== null && whole > chip.top - visible.top;
  return cutsChip ? keepsTitle : whole;
}
