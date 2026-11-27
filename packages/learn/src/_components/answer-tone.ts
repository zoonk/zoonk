/* In a module of their own so server components (the public pages) can draw an answer too. */

export type AnswerOptionResult = "guess" | "right" | "wrong";

/* Forced colors drop the tint and the ring, so a pick or a verdict keeps an outline there. */
const FORCED_OUTLINE =
  "forced-colors:outline-2 forced-colors:-outline-offset-2 forced-colors:outline-solid";

export const ANSWER_TONE = {
  guess: `ring-foreground/40 ring-[1.5px] ring-inset ${FORCED_OUTLINE}`,
  idle: "ring-input ring-1 ring-inset",
  picked: `bg-selected-tint contrast-more:ring-input ring-1 ring-transparent ring-inset ${FORCED_OUTLINE}`,
  right: `bg-success/9 ring-success ring-[1.5px] ring-inset ${FORCED_OUTLINE}`,
  wrong: `bg-destructive/9 ring-destructive ring-[1.5px] ring-inset ${FORCED_OUTLINE}`,
} as const;

/**
 * A press made before the page hydrates (`data-held`) shows the answer picked at once, or idle when
 * the press unpicks it.
 */
export const ANSWER_HELD_TONE = `data-held:bg-selected-tint data-held:ring-transparent contrast-more:data-held:ring-input forced-colors:data-held:outline-2 forced-colors:data-held:-outline-offset-2 forced-colors:data-held:outline-solid data-[held=unchecked]:bg-transparent! data-[held=unchecked]:ring-input! forced-colors:data-[held=unchecked]:outline-none!`;

export const ANSWER_TAG_TONE: Record<AnswerOptionResult, string> = {
  guess: "text-muted-foreground",
  right: "text-success-text",
  wrong: "text-destructive-text",
};

export const ANSWER_TAG_CLASS = "min-w-0 text-2xs leading-snug font-medium";

/** An answer's box without a text size, for a piece that takes the size of where it sits. */
export const ANSWER_BOX_CLASS =
  "relative flex w-full items-start gap-3 rounded-xl px-4 py-3.25 text-left leading-6 font-medium wrap-break-word";

export const ANSWER_OPTION_CLASS = `text-reading ${ANSWER_BOX_CLASS}`;
