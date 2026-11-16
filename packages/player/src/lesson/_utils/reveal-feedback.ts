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

export type Reveal = {
  delta: number;
  /** Room to add under the feedback first, where the screen can't scroll far enough without it. */
  extraRoom: number;
};

/**
 * How far a checked screen scrolls so its feedback is in sight: until the whole feedback shows,
 * and never past the feedback's own top. Why an answer was right or wrong matters more than the
 * title the learner just read, so the title may scroll away. What scrolls away leaves whole: a
 * chip or a title the scroll would cut is scrolled out, never left as a sliver under the top bar.
 * When the screen can't scroll that far (`room`), the title stays whole in sight if the whole
 * feedback still shows; otherwise the screen gets the room it lacks under the feedback.
 */
export function getReveal({
  chip,
  parts = [],
  feedback,
  room,
  title,
  visible,
}: {
  chip: Span | null;
  parts?: readonly Span[];
  feedback: Span;
  room: number;
  title: Span | null;
  visible: Span;
}): Reveal {
  const whole = getWholeFeedbackDelta(feedback, visible);

  function leaveWhole(span: Span, clear: number, delta = whole): Reveal | null {
    const top = span.top - visible.top;
    const out = Math.ceil(span.bottom - visible.top) + clear;

    if (delta <= top || delta >= out) {
      return null;
    }

    const kept = Math.floor(top);

    if (out > room && feedback.bottom - visible.bottom <= kept) {
      return { delta: kept, extraRoom: 0 };
    }

    return { delta: out, extraRoom: Math.max(0, out - room) };
  }

  const initial = (title && leaveWhole(title, 0)) ??
    (chip && leaveWhole(chip, CLEAR)) ?? { delta: whole, extraRoom: 0 };

  return parts
    .toSorted((first, second) => first.top - second.top)
    .reduce((reveal, part) => leaveWhole(part, 0, reveal.delta) ?? reveal, initial);
}
