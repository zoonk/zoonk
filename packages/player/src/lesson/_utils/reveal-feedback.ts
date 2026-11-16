type Span = { bottom: number; top: number };

const MARGIN = 16;

/** A chip's ring and a fraction of a pixel sit outside its box. */
const CLEAR = 2;

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
 * How far a checked screen scrolls so its feedback is in sight: until the whole feedback shows,
 * and never past the feedback's own top. Why an answer was right or wrong matters more than the
 * title the learner just read, so the title may scroll away. What scrolls away leaves whole: a
 * chip or a title the scroll would cut is scrolled out, never left as a sliver under the top bar.
 */
export function getRevealDelta({
  chip,
  feedback,
  title,
  visible,
}: {
  chip: Span | null;
  feedback: Span;
  title: Span | null;
  visible: Span;
}): number {
  const whole = getWholeFeedbackDelta(feedback, visible);

  if (!title) {
    return whole;
  }

  const headingTop = (chip ?? title).top - visible.top;
  const cutsHeading = whole > headingTop && whole < title.bottom - visible.top;

  if (!cutsHeading) {
    return whole;
  }

  const chipOut = chip ? Math.ceil(chip.bottom - visible.top) + CLEAR : 0;

  return chip && whole <= chipOut ? chipOut : title.bottom - visible.top;
}
