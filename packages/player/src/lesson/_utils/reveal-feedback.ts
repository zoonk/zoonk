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

  const protectedParts = [
    ...parts,
    ...(title ? [title] : []),
    ...(chip ? [{ bottom: chip.bottom + CLEAR, top: chip.top }] : []),
  ];

  const cuts = protectedParts
    .map((part) => ({
      bottom: Math.ceil(part.bottom - visible.top),
      top: Math.floor(part.top - visible.top),
    }))
    .toSorted((first, second) => first.top - second.top)
    .reduce<Span[]>((merged, part) => {
      const last = merged.at(-1);

      if (last && part.top < last.bottom) {
        last.bottom = Math.max(last.bottom, part.bottom);
      } else {
        merged.push(part);
      }

      return merged;
    }, []);

  const cut = cuts.find((part) => whole > part.top && whole < part.bottom);

  if (!cut) {
    return { delta: whole, extraRoom: Math.max(0, whole - room) };
  }

  const delta =
    cut.bottom > room && feedback.bottom - visible.bottom <= cut.top ? cut.top : cut.bottom;

  return { delta, extraRoom: Math.max(0, delta - room) };
}
