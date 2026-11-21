import { Fragment } from "react";

/**
 * Where a wrapped line of code reads best when it splits: before a `.`, after an opening bracket or
 * a comma, never inside an empty pair (`()`).
 */
const BREAK_POINTS = /(?=\.)|(?<=[(,[{])(?![)\]}])/u;

/**
 * A word of inline code this short fits on a line of the narrowest column, larger text included, so
 * it moves to the next line whole; only a longer one splits at its break points.
 */
const WHOLE_WORD_LENGTH = 20;

const WORDS = /(?<space>\s+)/u;

/**
 * Chromium reads a `<wbr>` as a line break, which would put a space in the name of what holds it
 * ("list( range(1))"), so screen readers skip it: it only lets the line wrap there.
 */
export function BreakPoint() {
  return <wbr aria-hidden="true" />;
}

export function withBreakPoints(text: string): React.ReactNode[] {
  return text.split(BREAK_POINTS).flatMap((part, index) => {
    const key = `${index}:${part}`;
    return index === 0 ? [part] : [<BreakPoint key={key} />, part];
  });
}

/** Inline code in a sentence: only a word too long to fit on a line splits, at its break points. */
export function withWordBreakPoints(text: string): React.ReactNode[] {
  return text.split(WORDS).map((word, index) => {
    const key = `${index}:${word}`;

    return word.length <= WHOLE_WORD_LENGTH ? (
      word
    ) : (
      <Fragment key={key}>{withBreakPoints(word)}</Fragment>
    );
  });
}

/** Whether a wrapped line may split where one run of code ends and the next begins. */
export function breaksBetween(before: string, after: string): boolean {
  return before !== "" && `${before.slice(-1)}${after.charAt(0)}`.split(BREAK_POINTS).length > 1;
}
