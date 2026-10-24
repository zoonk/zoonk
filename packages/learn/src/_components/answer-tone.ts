/*
 * The answer anatomy's looks, in a module of their own so a server component can draw an answer
 * too: the player and the app draw them live, and the public pages draw an answered question.
 */

/**
 * How a checked option turned out: the right answer, the learner's wrong pick, or their pick on a
 * guess that never counts (a lesson's "Guess first"), which isn't a mistake.
 */
export type AnswerOptionResult = "guess" | "right" | "wrong";

/**
 * The answer anatomy's states, for options and for the answer pieces that aren't options (word
 * tiles, match items, placed words): a strong line at rest, the learner's blue ring and tint when
 * picked (2px, since blue is lighter than the text color it replaced), and a green or red ring with
 * a faint tint once checked, while the words stay in the text color. A guess keeps a neutral ring
 * with no tint: only the right answer is colored.
 */
export const ANSWER_TONE = {
  guess: "ring-foreground/40 ring-[1.5px] ring-inset",
  idle: "ring-input ring-1 ring-inset",
  picked: "bg-selected-tint ring-selected ring-2 ring-inset",
  right: "bg-success/9 ring-success ring-[1.5px] ring-inset",
  wrong: "bg-destructive/9 ring-destructive ring-[1.5px] ring-inset",
} as const;

/** The word on a checked option's right ("Correct", "Your answer"), in its result's color. */
export const ANSWER_TAG_TONE: Record<AnswerOptionResult, string> = {
  guess: "text-muted-foreground",
  right: "text-success-text",
  wrong: "text-destructive-text",
};

/** That word's type: small and firm, so it reads beside the option's words without competing. */
export const ANSWER_TAG_CLASS = "shrink-0 text-[0.71875rem] font-[550]";

/** An option in a row: its key, its words and its tag on one line, the option's radius and type. */
export const ANSWER_OPTION_CLASS =
  "rounded-option relative flex w-full items-start gap-3 px-3.5 py-3.25 text-left text-[0.9375rem] leading-6 font-medium";
