type Span = { bottom: number; top: number };

const MARGIN = 16;

/** A chip's ring and a fraction of a pixel sit outside its box. */
const CLEAR = 2;

function getWholeFeedbackDelta(feedback: Span, visible: Span): number {
  if (feedback.top < visible.top) {
    return feedback.top - visible.top - MARGIN;
  }

  if (feedback.bottom <= visible.bottom) {
    return 0;
  }

  const toBottom = feedback.bottom - visible.bottom;
  const toTop = feedback.top - visible.top;

  if (toBottom > toTop) {
    return toTop - MARGIN;
  }

  return Math.min(toBottom + MARGIN, Math.max(toTop - MARGIN, toBottom));
}

/**
 * How far a checked screen scrolls so its feedback is in sight: until the whole feedback shows,
 * and never past the feedback's own top. Why an answer was right or wrong matters more than the
 * title the learner just read, so the title may scroll away. What scrolls away leaves whole: a
 * chip or a title the scroll would cut is scrolled out, never left as a sliver under the top bar.
 * When the screen can't scroll that far (`room`), it stays whole in sight instead, as long as the
 * whole feedback still shows.
 */
export function getRevealDelta({
  chip,
  feedback,
  room,
  title,
  visible,
}: {
  chip: Span | null;
  feedback: Span;
  room: number;
  title: Span | null;
  visible: Span;
}): number {
  const whole = getWholeFeedbackDelta(feedback, visible);

  function leaveWhole(span: Span, clear: number): number | null {
    const top = span.top - visible.top;
    const out = Math.ceil(span.bottom - visible.top) + clear;

    if (whole <= top || whole >= out) {
      return null;
    }

    if (out <= room) {
      return out;
    }

    const kept = Math.floor(top);
    return feedback.bottom - visible.bottom <= kept ? kept : whole;
  }

  return (title && leaveWhole(title, 0)) ?? (chip && leaveWhole(chip, CLEAR)) ?? whole;
}
