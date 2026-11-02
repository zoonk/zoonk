/* In a module of their own so server components (the public pages) can draw an answer too. */

export type AnswerOptionResult = "guess" | "right" | "wrong";

export const ANSWER_TONE = {
  guess: "ring-foreground/40 ring-[1.5px] ring-inset",
  idle: "ring-input ring-1 ring-inset",
  picked: "bg-selected-tint ring-selected ring-2 ring-inset",
  right: "bg-success/9 ring-success ring-[1.5px] ring-inset",
  wrong: "bg-destructive/9 ring-destructive ring-[1.5px] ring-inset",
} as const;

export const ANSWER_TAG_TONE: Record<AnswerOptionResult, string> = {
  guess: "text-muted-foreground",
  right: "text-success-text",
  wrong: "text-destructive-text",
};

export const ANSWER_TAG_CLASS = "shrink-0 text-[0.71875rem] font-[550]";

export const ANSWER_OPTION_CLASS =
  "rounded-option relative flex w-full items-start gap-3 px-3.5 py-3.25 text-left text-[0.9375rem] leading-6 font-medium";
